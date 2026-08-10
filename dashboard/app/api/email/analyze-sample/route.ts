import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { analyzeEmails } from "@/app/(dashboard)/calendar/aiService";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Hard cap to avoid runaway Groq spend in demo environments.
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function POST(request: Request): Promise<NextResponse> {
  // Guard: require GROQ_API_KEY before touching the database.
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error:
          "GROQ_API_KEY is not configured. Add it to .env.local and restart the server.",
      },
      { status: 500 }
    );
  }

  // Parse optional body.
  let force = false;
  let limit = DEFAULT_LIMIT;

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.force === "boolean") force = body.force;
    if (typeof body.limit === "number") {
      limit = Math.max(1, Math.min(Math.floor(body.limit), MAX_LIMIT));
    }
  } catch {
    // Malformed JSON — use defaults.
  }

  // Query only seeded (synthetic) emails: those with no gmailMessageId.
  // When force=false (default) also skip emails that already have aiAnalysis.
  //
  // Note: Prisma 7 generates StringFilter (not StringNullableFilter) for @unique
  // nullable fields, so we cast to satisfy the type checker while the runtime
  // correctly emits IS NULL for null values.
  const where = {
    gmailMessageId: null,
    ...(force ? {} : { aiAnalysis: null }),
  } as unknown as Prisma.EmailWhereInput;

  const candidates = await prisma.email.findMany({
    where,
    orderBy: { receivedAt: "asc" },
    take: limit,
    select: {
      id: true,
      fromName: true,
      fromEmail: true,
      subject: true,
      body: true,
    },
  });

  const totalCandidates = candidates.length;

  if (totalCandidates === 0) {
    return NextResponse.json({
      success: true,
      totalCandidates: 0,
      analyzed: 0,
      skipped: 0,
      failed: 0,
      tasksCreated: 0,
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
    return NextResponse.json(
      {
        success: false,
        error: "AI analysis failed.",
        details: err instanceof Error ? err.message : String(err),
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
  const errors: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const analysis = analyses[i];

    if (!analysis) {
      failed++;
      errors.push(`Email ${row.id}: no analysis result returned.`);
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
      errors.push(
        `Email ${row.id}: persist failed — ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  const success = failed === 0;

  return NextResponse.json(
    {
      success,
      totalCandidates,
      analyzed,
      skipped: 0,
      failed,
      tasksCreated: 0,
      ...(errors.length > 0 ? { errors } : {}),
    },
    { status: success ? 200 : 207 }
  );
}
