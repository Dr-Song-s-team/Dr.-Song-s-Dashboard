import { NextResponse } from "next/server";
import { analyzeEmails } from "@/app/(dashboard)/calendar/aiService";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Hard cap to avoid runaway Groq spend in demo environments.
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 200;
const MAX_SELECTED_EMAILS = 3;
type SampleEmail = {
  id: string;
  gmailMessageId: string | null;
  fromEmail: string;
  subject: string;
  body: string;
  aiAnalysis: unknown;
};

async function getRemainingSampleEmails(): Promise<number> {
  const emails = await prisma.email.findMany({
    select: {
      gmailMessageId: true,
      aiAnalysis: true,
    },
  });

  return emails.filter(
    (email) => email.gmailMessageId === null && email.aiAnalysis === null
  ).length;
}

export async function POST(request: Request): Promise<NextResponse> {
  // Guard: require GROQ_API_KEY before touching the database.
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: "AI analysis is unavailable. Please try again later.",
      },
      { status: 500 }
    );
  }

  // Parse optional body.
  let force = false;
  let limit = DEFAULT_LIMIT;
  let selectedEmailIds: string[] | undefined;

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.force === "boolean") force = body.force;
    if (typeof body.limit === "number") {
      limit = Math.max(1, Math.min(Math.floor(body.limit), MAX_LIMIT));
    }
    if (Array.isArray(body.emailIds)) {
      const requestedEmailIds = body.emailIds;
      if (
        requestedEmailIds.length === 0 ||
        requestedEmailIds.length > MAX_SELECTED_EMAILS ||
        requestedEmailIds.some((id: unknown) => typeof id !== "string" || !id)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Select between 1 and ${MAX_SELECTED_EMAILS} emails to analyze.`,
          },
          { status: 400 }
        );
      }
      const uniqueEmailIds = [...new Set(requestedEmailIds)] as string[];
      if (uniqueEmailIds.length !== requestedEmailIds.length) {
        return NextResponse.json(
          {
            success: false,
            error: "Each selected email must be unique.",
          },
          { status: 400 }
        );
      }
      selectedEmailIds = uniqueEmailIds;
    }
  } catch {
    // Malformed JSON — use defaults.
  }

  // Prisma 7 currently exposes the nullable, unique gmailMessageId field as a
  // non-nullable StringFilter. Filter this modest demo inbox in application
  // code instead, avoiding an invalid `gmailMessageId: null` Prisma query.
  let candidates: SampleEmail[];
  try {
    const emails = await prisma.email.findMany({
      orderBy: { receivedAt: "desc" },
      select: {
        id: true,
        gmailMessageId: true,
        fromEmail: true,
        subject: true,
        body: true,
        aiAnalysis: true,
      },
    });

    if (selectedEmailIds) {
      const emailsById = new Map(emails.map((email) => [email.id, email]));
      const selectedCandidates = selectedEmailIds.map((id) => emailsById.get(id));

      if (
        selectedCandidates.some(
          (email) =>
            !email ||
            email.gmailMessageId !== null ||
            (!force && email.aiAnalysis !== null)
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Selected emails must be un-analyzed messages from the sample inbox.",
          },
          { status: 400 }
        );
      }
      candidates = selectedCandidates.filter(
        (email): email is (typeof emails)[number] => Boolean(email)
      );
    } else {
      candidates = emails
        .filter(
          (email) =>
            email.gmailMessageId === null &&
            (force || email.aiAnalysis === null)
        )
        .slice(0, limit);
    }
  } catch (err) {
    console.error("[sample-inbox] Failed to load inbox candidates.", {
      error: err instanceof Error ? err.name : "UnknownError",
    });
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load sample inbox emails.",
      },
      { status: 500 }
    );
  }

  const totalCandidates = candidates.length;

  if (totalCandidates === 0) {
    return NextResponse.json({
      success: true,
      totalCandidates: 0,
      analyzed: 0,
      skipped: 0,
      failed: 0,
      tasksCreated: 0,
      remaining: 0,
      hasMore: false,
    });
  }

  // Record batch start for timing and error-rate metrics.
  const batchStartedAt = new Date();
  let batchId: string | null = null;
  try {
    const batch = await prisma.analysisBatch.create({
      data: { startedAt: batchStartedAt, emailsAttempted: totalCandidates },
    });
    batchId = batch.id;
  } catch (err) {
    console.error("[sample-inbox] Failed to create analysis batch record.", {
      error: err instanceof Error ? err.name : "UnknownError",
    });
  }

  // Map Prisma rows to the shape analyzeEmails expects.
  const emailInputs = candidates.map((row) => ({
    id: row.id,
    sender: row.fromEmail,
    subject: row.subject,
    body: row.body,
  }));

  // Run the existing batch analyzer (batches of 3, 1 s pause, retry, redaction).
  let analyses;
  try {
    analyses = await analyzeEmails(emailInputs);
  } catch (err) {
    console.error("[sample-inbox] AI analysis failed.", {
      error: err instanceof Error ? err.name : "UnknownError",
    });

    // Record the failed batch.
    if (batchId) {
      const completedAt = new Date();
      await prisma.analysisBatch.update({
        where: { id: batchId },
        data: {
          completedAt,
          durationMs: completedAt.getTime() - batchStartedAt.getTime(),
          emailsFailed: totalCandidates,
          success: false,
        },
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        success: false,
        error: "AI provider rejected the request. Please try again later.",
        totalCandidates,
        analyzed: 0,
        skipped: 0,
        failed: totalCandidates,
        tasksCreated: 0,
      },
      { status: 500 }
    );
  }

  // Persist results. Track per-email failures so one bad persist doesn't abort all.
  let analyzed = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const analysis = analyses[i];

    if (!analysis) {
      failed++;
      continue;
    }

    try {
      await prisma.email.update({
        where: { id: row.id },
        data: {
          aiSummary: analysis.summaryTitle || null,
          aiDraft: analysis.draftResponse || null,
          aiAnalysis: {
            category: analysis.category,
            urgency: analysis.urgency,
            actionRequired: analysis.actionRequired,
            summaryTitle: analysis.summaryTitle,
            summaryDetails: analysis.summaryDetails ?? [],
            clientTags: analysis.clientTags ?? [],
            recommendedActions: analysis.recommendedActions ?? null,
            dueDate: analysis.dueDate ?? null,
            dueTime: analysis.dueTime ?? null,
          },
        },
      });
      analyzed++;
    } catch (err) {
      failed++;
      console.error("[sample-inbox] Failed to persist analysis.", {
        emailId: row.id,
        error: err instanceof Error ? err.name : "UnknownError",
      });
    }
  }

  const success = failed === 0;

  // Finalize the batch timing record.
  if (batchId) {
    const completedAt = new Date();
    await prisma.analysisBatch.update({
      where: { id: batchId },
      data: {
        completedAt,
        durationMs: completedAt.getTime() - batchStartedAt.getTime(),
        emailsSucceeded: analyzed,
        emailsFailed: failed,
        success,
      },
    }).catch((err) => {
      console.error("[sample-inbox] Failed to finalize batch record.", {
        error: err instanceof Error ? err.name : "UnknownError",
      });
    });
  }

  let remaining = 0;

  try {
    remaining = await getRemainingSampleEmails();
  } catch (err) {
    console.error("[sample-inbox] Failed to count remaining inbox emails.", {
      error: err instanceof Error ? err.name : "UnknownError",
    });
  }

  return NextResponse.json(
    {
      success,
      ...(success
        ? {}
        : { error: "Some email analyses could not be completed." }),
      totalCandidates,
      analyzed,
      skipped: 0,
      failed,
      tasksCreated: 0,
      remaining,
      hasMore: remaining > 0,
    },
    { status: success ? 200 : 207 }
  );
}
