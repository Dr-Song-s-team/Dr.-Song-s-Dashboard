import { loadAllEmails } from "./csvParser";
import { AnalyzedEmail, analyzeEmails, clearTranslationCache } from "./aiService";

let cache = [];
let isReady = false;

function getCache() {
  return cache;
}

function isAnalysisReady() {
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

  // Default task time if AI does not provide one
  const finalTime = time || "09:00 AM";

  const parsed = new Date(`${date} ${finalTime}`);

  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}


export async function createTasksFromAnalysis(emails, analyses) {

  for (let i = 0; i < analyses.length; i++) {

    const email = emails[i];
    const analysis = analyses[i];


    if (!analysis.actionRequired) continue;

    if (
      !analysis.recommendedActions ||
      analysis.recommendedActions.length === 0
    ) {
      continue;
    }


    const description = [
      analysis.summaryTitle,
      ...analysis.summaryDetails,
    ]
      .filter(Boolean)
      .join("\n");


    for (const action of analysis.recommendedActions) {

      try {

        const dueDate = formatDueDate(
          analysis.dueDate,
          analysis.dueTime
        );


        const res = await fetch(
          "http://localhost:3000/api/events",
          {
            method: "POST",

            headers:{
              "Content-Type":"application/json",
            },

            body: JSON.stringify({

              title: action,

              description,

              // Example:
              // 2026-07-27T10:00:00.000Z
              due: dueDate,


              emailId:
                email.id ?? null,


              reminders:
                dueDate
                ? [
                    {
                      remindAt:
                        new Date(
                          new Date(dueDate).getTime()
                          -
                          15 * 60 * 1000
                        ).toISOString()
                    }
                  ]
                : []

            }),
          }
        );


        if (!res.ok) {

          const error =
            await res.text();

          console.error(
            `Failed creating task "${action}":`,
            error
          );

        } else {

          console.log(
            `Created task: ${action}`
          );

        }


      } catch(err){

        console.error(
          `Error creating task "${action}"`,
          err
        );

      }

    }
  }
}

async function loadAndAnalyzeEmails(forceRefresh = false) {
  if (isReady && !forceRefresh) return;

  isReady = false;
  if (forceRefresh) clearTranslationCache();

  const emails = loadAllEmails();

  let analyses;
  try {
  analyses = await analyzeEmails(emails);
}
catch(err){
  console.warn("AI failed:", err.message);
  analyses = ruleBasedFallback(emails);
}


try {
  await createTasksFromAnalysis(
    emails,
    analyses
  );
}
catch(err){
  console.error(
    "Task creation failed:",
    err
  );
}

  cache = emails.map((email, i) => ({
    ...email,
    ...analyses[i],
  }));

  isReady = true;
  console.log(`Analysis complete — ${cache.length} emails processed.`);
}

module.exports = { loadAndAnalyzeEmails, getCache, isAnalysisReady };
