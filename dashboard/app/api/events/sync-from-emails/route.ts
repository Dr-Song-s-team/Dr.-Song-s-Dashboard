import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  analyzeSchedulingEmailBatch,
  extractTasksDeterministically,
  loadEntities,
} from "@/app/(dashboard)/calendar/aiService";
import type { SchedulingEmail } from "@/app/(dashboard)/calendar/aiService";

const EMAIL_BATCH_SIZE = 3;

/**
 * Check if an error is a rate limit error (429)
 */
function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("rate_limit_exceeded")
  );
}

/**
 * Sleep helper for rate limit prevention
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST /api/events/sync-from-emails
 *
 * Extracts scheduling events/action items from emails in the database
 * and creates Task rows. Only processes emails that:
 * - Have classification SCHEDULING OR status NEEDS_ACTION
 * - Don't already have associated tasks
 *
 * Processes emails in batches (3 per batch) with incremental task creation.
 * If AI rate limits are hit, uses deterministic extraction as fallback.
 * Circuit breaker: after first 429, skips AI for remaining batches.
 *
 * Deduplicates via emailId + title (same logic as POST /api/events).
 */
export async function POST() {
  try {
    // Load emails that need scheduling analysis (cap at 9 to stay under rate limits)
    const emails = await prisma.email.findMany({
      where: {
        OR: [{ classification: "SCHEDULING" }, { status: "NEEDS_ACTION" }],
        // Skip emails that already have tasks
        tasks: { none: {} },
      },
      orderBy: { receivedAt: "asc" },
      take: 9,
    });

    // Check if more emails remain after this batch
    const totalSyncableEmails = await prisma.email.count({
      where: {
        OR: [{ classification: "SCHEDULING" }, { status: "NEEDS_ACTION" }],
        tasks: { none: {} },
      },
    });

    if (emails.length === 0) {
      return NextResponse.json({
        created: 0,
        aiAnalyzed: 0,
        fallback: 0,
        skipped: 0,
        total: 0,
        message: "No emails to process",
      });
    }

    // Transform to SchedulingEmail format
    const schedulingEmails: SchedulingEmail[] = emails.map((email) => ({
      id: email.id,
      sender: `${email.fromName} <${email.fromEmail}>`,
      subject: email.subject,
      body: email.body,
      fromName: email.fromName,
    }));

    // Load entities once for all batches
    const entities = await loadEntities();

    // Split into batches
    const batches: SchedulingEmail[][] = [];
    for (let index = 0; index < schedulingEmails.length; index += EMAIL_BATCH_SIZE) {
      batches.push(schedulingEmails.slice(index, index + EMAIL_BATCH_SIZE));
    }

    let created = 0;
    let skipped = 0;
    let aiAnalyzed = 0;
    let fallback = 0;
    let rateLimitTripped = false; // Circuit breaker flag

    // Process batches incrementally
    for (const batch of batches) {
      let results;
      let batchUsedFallback = false;

      // Circuit breaker: skip AI after first 429
      if (rateLimitTripped) {
        console.warn("Circuit breaker active: using deterministic extraction for batch");
        results = extractTasksDeterministically(batch);
        fallback += batch.length;
        batchUsedFallback = true;
      } else {
        try {
          results = await analyzeSchedulingEmailBatch(batch, entities);
          aiAnalyzed += batch.length;
          batchUsedFallback = false;
        } catch (err) {
          if (isRateLimitError(err)) {
            console.warn("Rate limit hit, falling back to deterministic extraction");
            rateLimitTripped = true; // Activate circuit breaker
            results = extractTasksDeterministically(batch);
            fallback += batch.length;
            batchUsedFallback = true;
          } else {
            // Genuine error (DB, network, etc.) - fail the sync
            throw err;
          }
        }
      }

      // Create tasks from this batch's results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const schedulingEmail = batch[i];

        // Find the original email object
        const email = emails.find((e) => e.id === result.id);
        if (!email) continue;

        // Skip if no actionable scheduling info
        if (!result.title || result.title.trim() === "") {
          continue;
        }

        // Build dueDate from result.date and result.time
        let dueDate: Date | null = null;
        if (result.date) {
          const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.test(result.date);
          if (dateMatch) {
            if (result.time) {
              // Parse time in HH:MM format (24h)
              const timeMatch = result.time.match(/^(\d{2}):(\d{2})$/);
              if (timeMatch) {
                dueDate = new Date(`${result.date}T${result.time}:00-08:00`);
              } else {
                // Fallback: just use date at noon
                dueDate = new Date(`${result.date}T12:00:00-08:00`);
              }
            } else {
              // No time specified, default to noon
              dueDate = new Date(`${result.date}T12:00:00-08:00`);
            }
          }
        }

        // Check for existing task (dedup logic from POST /api/events)
        const existing = await prisma.task.findFirst({
          where: {
            emailId: email.id,
            title: result.title,
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Find patient by name if mentioned
        let patientId: string | null = null;
        if (result.patientName && result.patientName !== "Unknown") {
          // Try to match patient by name
          const nameParts = result.patientName.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(" ");

            const patient = await prisma.patient.findFirst({
              where: {
                firstName: { equals: firstName, mode: "insensitive" },
                lastName: { equals: lastName, mode: "insensitive" },
              },
            });

            if (patient) {
              patientId = patient.id;
            }
          }
        }

        // Build description with fallback marker if applicable
        const baseDescription = `From email: ${email.subject}`;
        const description = batchUsedFallback
          ? `Auto-created without AI — review details\n\n${baseDescription}`
          : baseDescription;

        // Create task
        const task = await prisma.task.create({
          data: {
            title: result.title,
            description,
            dueDate,
            emailId: email.id,
            patientId,
            status: "PENDING",
            extractionStatus: "PENDING_REVIEW",
          },
        });

        created++;

        // Attempt Google Calendar sync (gracefully fails if no account)
        if (dueDate) {
          try {
            const { getGoogleCalendar, buildGoogleReminders } = await import(
              "@/lib/googleCalendar"
            );

            const calendar = await getGoogleCalendar();

            const googleEvent = await calendar.events.insert({
              calendarId: "primary",
              requestBody: {
                summary: task.title,
                description: task.description ?? undefined,
                start: {
                  dateTime: dueDate.toISOString(),
                  timeZone: "America/Los_Angeles",
                },
                end: {
                  dateTime: new Date(dueDate.getTime() + 30 * 60 * 1000).toISOString(),
                  timeZone: "America/Los_Angeles",
                },
                reminders: buildGoogleReminders([], dueDate),
              },
            });

            if (googleEvent.data.id) {
              await prisma.task.update({
                where: { id: task.id },
                data: { googleEventId: googleEvent.data.id },
              });
            }
          } catch (calendarError) {
            console.error("Google Calendar creation failed for task", task.id, ":", calendarError);
            // Task still exists locally - calendar sync can be retried later
          }
        }
      }

      // Rate limit prevention between batches
      await sleep(1000);
    }

    // Build response message
    let message = `Processed ${emails.length} emails: ${created} tasks created`;
    if (fallback > 0) {
      message += ` (${aiAnalyzed} AI-analyzed, ${fallback} fallback)`;
    }
    if (skipped > 0) {
      message += `, ${skipped} duplicates skipped`;
    }

    // Calculate remaining emails (after tasks from this batch are created)
    const remainingCount = totalSyncableEmails - emails.length;
    if (remainingCount > 0) {
      message += ` — ${remainingCount} more emails pending, click Sync again`;
    }

    return NextResponse.json({
      created,
      aiAnalyzed,
      fallback,
      skipped,
      total: emails.length,
      message,
    });
  } catch (error) {
    console.error("Failed to sync tasks from emails:", error);

    return NextResponse.json(
      {
        error: "Failed to sync tasks from emails",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
