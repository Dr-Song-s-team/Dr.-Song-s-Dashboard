import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeSchedulingEmails } from "@/app/(dashboard)/calendar/aiService";
import type { SchedulingEmail } from "@/app/(dashboard)/calendar/aiService";

/**
 * POST /api/events/sync-from-emails
 *
 * Extracts scheduling events/action items from emails in the database
 * and creates Task rows. Only processes emails that:
 * - Have classification SCHEDULING OR status NEEDS_ACTION
 * - Don't already have associated tasks
 *
 * Uses existing analyzeSchedulingEmails() pipeline with built-in:
 * - Batching (3 emails per batch)
 * - PII redaction
 * - Rate limiting with retry
 *
 * Deduplicates via emailId + title (same logic as POST /api/events).
 */
export async function POST() {
  try {
    // Load emails that need scheduling analysis
    const emails = await prisma.email.findMany({
      where: {
        OR: [
          { classification: "SCHEDULING" },
          { status: "NEEDS_ACTION" },
        ],
        // Skip emails that already have tasks
        tasks: { none: {} },
      },
      orderBy: { receivedAt: "asc" },
    });

    if (emails.length === 0) {
      return NextResponse.json({
        created: 0,
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
    }));

    // Analyze emails using existing AI pipeline
    // This handles batching (3/batch), redaction, rate limits
    const results = await analyzeSchedulingEmails(schedulingEmails);

    let created = 0;
    let skipped = 0;

    // Create tasks from results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const email = emails[i];

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
              dueDate = new Date(
                `${result.date}T${result.time}:00-08:00`
              );
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

      // Create task
      const task = await prisma.task.create({
        data: {
          title: result.title,
          description: `From email: ${email.subject}`,
          dueDate,
          emailId: email.id,
          patientId,
          status: "PENDING",
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
                dateTime: new Date(
                  dueDate.getTime() + 30 * 60 * 1000
                ).toISOString(),
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
          console.error(
            "Google Calendar creation failed for task",
            task.id,
            ":",
            calendarError
          );
          // Task still exists locally - calendar sync can be retried later
        }
      }
    }

    return NextResponse.json({
      created,
      skipped,
      total: emails.length,
      message: `Processed ${emails.length} emails: ${created} tasks created, ${skipped} duplicates skipped`,
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
