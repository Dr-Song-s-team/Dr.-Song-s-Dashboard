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
      recommendedAction: actionRequired
        ? 'Review and respond to this email'
        : null,
      draftResponse,
    };
  });
}

function getDueDate(analysis) {
  const due = new Date();

  switch (analysis.urgency) {
    case "high":
      due.setDate(due.getDate() + 1);
      break;

    case "medium":
      due.setDate(due.getDate() + 3);
      break;

    default:
      due.setDate(due.getDate() + 7);
      break;
  }

  return due.toISOString();
}

export async function createTasksFromAnalysis(emails, analyses) {
  for (let i = 0; i < analyses.length; i++) {
    const email = emails[i];
    const analysis = analyses[i];

    if (!analysis.actionRequired) continue;
    if (!analysis.recommendedActions?.length) continue;

    const description = [
      analysis.summaryTitle,
      ...analysis.summaryDetails,
    ]
      .filter(Boolean)
      .join("\n");

    for (const action of analysis.recommendedActions) {
      try {
        const res = await fetch("http://localhost:3001/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: action,
            description,
            due: getDueDate(analysis),

            // Include these if available
            emailId: email.id ?? null,
            reminders: [],
          }),
        });

        if (!res.ok) {
          console.error(
            `Failed creating task "${action}" (${res.status})`
          );
        }
      } catch (err) {
        console.error(
          `Failed creating task "${action}" for "${email.subject}"`,
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

    await createTasksFromAnalysis(emails, analyses);

    cache = emails.map((email, i) => ({
        ...email,
        ...analyses[i],
    }));
  } catch (err) {
    console.warn('AI analysis failed, using rule-based fallback:', err.message);
    analyses = ruleBasedFallback(emails);
  }

  cache = emails.map((email, i) => ({
    ...email,
    ...analyses[i],
  }));

  isReady = true;
  console.log(`Analysis complete — ${cache.length} emails processed.`);
}

module.exports = { loadAndAnalyzeEmails, getCache, isAnalysisReady };
