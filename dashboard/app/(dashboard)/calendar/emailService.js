import { loadAllEmails } from "./csvParser";
import { AnalyzedEmail, analyzeEmails, clearTranslationCache } from "./aiService";
import { prisma } from "@/lib/prisma";

let cache = [];
let isReady = false;

export function getCache() {
  return cache;
}

export function isAnalysisReady() {
  return isReady;
}

function ruleBasedFallback(emails) {
  return emails.map(email => {
    const sender = email.sender.toLowerCase();
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();

    let category = 'client';
    if (sender.includes('insurance') || sender.includes('claims')) {
      category = 'insurance';
    } else if (
      sender.includes('market') ||
      sender.includes('deals') ||
      sender.includes('promo')
    ) {
      category = 'spam';
    }

    const urgencyKeywords = [
      'urgent', 'immediately', 'required', 'denial', 'deadline',
      'overdue', 'penalty', 'failure', 'fourteen days', 'thirty days',
    ];
    const hasUrgentKeyword = urgencyKeywords.some(
      k => subject.includes(k) || body.includes(k)
    );

    const actionKeywords = [
      'please submit', 'please provide', 'please upload', 'contact',
      'reply', 'required', 'must', 'need', 'request',
    ];
    const actionRequired =
      category !== 'spam' &&
      actionKeywords.some(k => subject.includes(k) || body.includes(k));

    const urgency =
      category === 'spam'
        ? 'low'
        : hasUrgentKeyword
        ? 'high'
        : actionRequired
        ? 'medium'
        : 'low';

    const detailSentences = email.body
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean)
      .slice(0, 4);

    const firstName = email.senderName.split(' ')[0] || 'there';
    const draftResponse = category === 'client' && actionRequired
      ? `Hi ${firstName},\n\nThank you for reaching out about "${email.subject}." We have received your message and will review your request with Dr. Huy. We will follow up shortly with the next steps or any information we need from you.\n\nBest,\nDr. Huy's Clinic`
      : null;
    const namedClients = [...`${email.subject} ${email.body}`.matchAll(
      /\b(?:patient|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/g
    )].map(match => match[1].trim());
    const clientTags = category === 'client'
      ? [email.senderName]
      : category === 'insurance'
        ? [...new Set(namedClients)]
        : [];

    return {
      category,
      urgency,
      actionRequired,
      summaryTitle: email.subject,
      summaryDetails: detailSentences,
      clientTags,
      summary: email.subject,
      recommendedActions:
  actionRequired
    ? [
        "Review and respond to this email"
      ]
    : null,
      draftResponse,
    };
  });
}

function formatDueDate(date, time) {
  if (!date) return null;

  // If AI doesn't provide a time, use 11:59 PM
  const finalTime = time || "11:59 PM";

  const parsed = new Date(`${date} ${finalTime}`);

  if (isNaN(parsed.getTime())) {
    console.warn(
      "Could not parse due date:",
      date,
      finalTime
    );

    return null;
  }

  return parsed.toISOString();
}

export async function ensureEmailExists(email) {
  const gmailMessageId = email.id;

  if (!gmailMessageId) {
    throw new Error(
      "Cannot import email without Gmail message ID"
    );
  }

  const existing = await prisma.email.findUnique({
    where: {
      gmailMessageId,
    },
  });

  if (existing) {
    return existing;
  }

  const sender =
    email.sender ??
    email.fromEmail ??
    "";

  const senderName =
    email.senderName ??
    email.fromName ??
    sender;

  const senderEmail =
    email.senderEmail ??
    email.fromEmail ??
    sender;

  const created = await prisma.email.create({
    data: {
      gmailMessageId,

      gmailThreadId:
        email.threadId ??
        email.gmailThreadId ??
        null,

      gmailAccountId:
        email.gmailAccountId ??
        null,

      toInbox:
        email.toInbox ??
        "INFO",

      fromName: senderName,

      fromEmail: senderEmail,

      subject:
        email.subject ??
        "",

      body:
        email.body ??
        "",

      receivedAt:
        email.receivedAt
          ? new Date(email.receivedAt)
          : new Date(),

      patientId:
        email.patientId ??
        null,
    },
  });

  return created;
}

export async function createTasksFromAnalysis(
  emails,
  analyses
) {
  console.log(
    `createTasksFromAnalysis: processing ${analyses.length} analyses`
  );

  for (let i = 0; i < analyses.length; i++) {
    const email = emails[i];
    const analysis = analyses[i];

    if (!email) {
      console.warn(
        `No email found for analysis index ${i}`
      );
      continue;
    }

    if (!analysis) {
      console.warn(
        `No analysis found for email index ${i}`
      );
      continue;
    }

    try {
      /*
       * Get the Prisma Email record.
       *
       * email.id = Gmail message ID
       * prismaEmail.id = Prisma cuid
       */
      const prismaEmail =
        await ensureEmailExists(email);

      console.log(
        `Prisma email ID: ${prismaEmail.id}`
      );

      /*
       * Save the complete AI analysis to the Email record.
       *
       * This happens BEFORE checking actionRequired,
       * so even emails without tasks have their AI
       * information available on the email details page.
       */
      await prisma.email.update({
        where: {
          id: prismaEmail.id,
        },
        data: {
          aiSummary:
            analysis.summaryTitle ||
            analysis.summary ||
            null,

          aiDraft:
            analysis.draftResponse ||
            null,

          aiAnalysis: {
            category: analysis.category,
            urgency: analysis.urgency,
            actionRequired: analysis.actionRequired,
            summaryTitle: analysis.summaryTitle,
            summaryDetails: analysis.summaryDetails ?? [],
            clientTags: analysis.clientTags ?? [],
            recommendedActions:
              analysis.recommendedActions ?? null,
            dueDate: analysis.dueDate ?? null,
            dueTime: analysis.dueTime ?? null,
          },
        },
      });

      console.log(
        `Saved AI analysis -> Email ${prismaEmail.id}`
      );

      /*
       * No task required.
       *
       * We still saved the AI analysis above.
       */
      if (!analysis.actionRequired) {
        console.log(
          `Skipping tasks for ${email.id}: no action required`
        );
        continue;
      }

      if (
        !analysis.recommendedActions ||
        analysis.recommendedActions.length === 0
      ) {
        console.log(
          `Skipping tasks for ${email.id}: no recommended actions`
        );
        continue;
      }

      /*
       * Combine AI dueDate + dueTime.
       */
      const dueDate = formatDueDate(
        analysis.dueDate,
        analysis.dueTime
      );

      const description = [
        analysis.summaryTitle,
        ...(analysis.summaryDetails || []),
      ]
        .filter(Boolean)
        .join("\n");

      /*
       * Create one Task for every recommended action.
       */
      for (const action of analysis.recommendedActions) {
        if (!action || !action.trim()) {
          continue;
        }

        const title = action.trim();

        const res = await fetch(
          "http://localhost:3000/api/events",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              title,
              description,
              due: dueDate,

              /*
               * IMPORTANT:
               * Prisma Email ID, NOT Gmail message ID.
               */
              emailId: prismaEmail.id,

              patientId:
                email.patientId ?? null,

              reminders:
                dueDate
                  ? [
                      {
                        remindAt:
                          new Date(
                            new Date(dueDate).getTime() -
                              15 * 60 * 1000
                          ).toISOString(),
                      },
                    ]
                  : [],
            }),
          }
        );

        if (!res.ok) {
          const error = await res.text();

          console.error(
            `Failed creating task "${title}":`,
            error
          );

          continue;
        }

        const task = await res.json();

        console.log(
          `Created task "${title}" ->`,
          `Task ${task.id}`,
          `-> Email ${prismaEmail.id}`
        );
      }
    } catch (err) {
      console.error(
        `Error processing email ${email.id}:`,
        err
      );
    }
  }
}