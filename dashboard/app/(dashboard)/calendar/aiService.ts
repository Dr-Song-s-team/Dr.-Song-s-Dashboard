/**
 * AI service for email analysis and translation.
 * Routes all AI calls through the Groq provider with PII redaction.
 *
 * This replaces geminiService.js — all function signatures and return shapes
 * are preserved for backward compatibility with existing calendar UI code.
 */

import { callAI } from "@/lib/ai/provider";
import { loadEntities, redact, unredact, scanText } from "@/lib/redaction";
import type { EntityData } from "@/lib/redaction";

const EMAIL_BATCH_SIZE = 25;

const ANALYSIS_SYSTEM = `You are an AI assistant for Dr. Huy, a licensed acupuncturist. Analyze clinic emails and return a JSON array.

For each email return an object with:
- "category": "client" | "insurance" | "spam"
- "urgency": "high" | "medium" | "low"
- "actionRequired": true | false
- "summaryTitle": an 8-14 word plain-language gist of what the email is about
- "summaryDetails": an array of 3-6 concise, easy-to-understand detail strings. Include concrete names, dates, times, requests, deadlines, and consequences when present.
- "clientTags": an array of every patient/client full name mentioned or directly associated with the email. For a patient email, include the sender's name. Use an empty array only when no client is identifiable.
- "recommendedAction": specific action string for staff, or null if none needed
- "draftResponse": a warm, professional response the clinic can edit and send. Address the sender by first name when appropriate, directly acknowledge their request, and state the next step. Use null for spam or messages that should not receive a reply.

Urgency rules:
- "high": immediate deadline or consequence (claim denial risk, documentation due <14 days, urgent medical concern)
- "medium": needs attention soon (patient questions needing reply, new intake requests, doc requests with reasonable timeline)
- "low": informational only (progress updates, payment confirmations, spam/marketing)

Category rules:
- "client": emails from patients about care, symptoms, appointments, or billing
- "insurance": emails from insurance companies about coverage, claims, documentation
- "spam": marketing, promotional, vendor, or irrelevant emails

Return ONLY a valid JSON array with no markdown, no explanation.`;

interface Email {
  sender: string;
  subject: string;
  body: string;
}

interface AnalyzedEmail {
  category: "client" | "insurance" | "spam";
  urgency: "high" | "medium" | "low";
  actionRequired: boolean;
  summaryTitle: string;
  summaryDetails: string[];
  clientTags: string[];
  summary: string;
  recommendedAction: string | null;
  draftResponse: string | null;
}

interface SchedulingEmail {
  id: string;
  sender: string;
  subject: string;
  body: string;
}

interface SchedulingResult {
  id: string;
  type: "appointment" | "reschedule" | "cancellation" | "deadline" | "inquiry";
  patientName: string;
  date: string | null;
  time: string | null;
  title: string;
  urgency: "high" | "medium" | "low";
  category: "client" | "insurance";
}

// Type for unknown JSON responses from AI
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnknownJSON = any;

/**
 * Analyze a batch of emails once (no retry logic).
 * @internal
 */
async function analyzeEmailBatchOnce(
  emails: Email[],
  entities: EntityData
): Promise<AnalyzedEmail[]> {
  // Redact each email's sender, subject, and body
  const redactedEmails = emails.map((e) => {
    const senderRedaction = redact(e.sender, entities);
    const subjectRedaction = redact(e.subject, entities);
    const bodyRedaction = redact(e.body, entities);

    return {
      redactedSender: senderRedaction.redactedText,
      redactedSubject: subjectRedaction.redactedText,
      redactedBody: bodyRedaction.redactedText,
      // Merge all token maps for unredaction
      tokenMap: new Map([
        ...senderRedaction.tokenMap,
        ...subjectRedaction.tokenMap,
        ...bodyRedaction.tokenMap,
      ]),
    };
  });

  // Build the prompt with redacted content
  const emailBlocks = redactedEmails
    .map(
      (e, i) =>
        `[${i}]\nFrom: ${e.redactedSender}\nSubject: ${e.redactedSubject}\nBody:\n${e.redactedBody}`
    )
    .join("\n\n---\n\n");

  const prompt = `${ANALYSIS_SYSTEM}\n\nEmails:\n\n${emailBlocks}`;

  // Redact the entire prompt (to get the RedactedText branded type)
  const finalRedaction = redact(prompt, entities);

  // Call AI with redacted text
  const aiResponse = await callAI(finalRedaction.redactedText, {
    systemPrompt: ANALYSIS_SYSTEM,
    jsonMode: true,
    timeoutMs: 60000,
  });

  // Unredact the AI response
  const { originalText: unredactedResponse } = unredact(
    aiResponse,
    finalRedaction.tokenMap
  );

  // Parse JSON response
  const jsonText = unredactedResponse.startsWith("```")
    ? unredactedResponse
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim()
    : unredactedResponse;

  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed) || parsed.length !== emails.length) {
    throw new Error(`Expected ${emails.length} results, got ${parsed.length}`);
  }

  // Validate and normalize each result
  return parsed.map((item: UnknownJSON): AnalyzedEmail => ({
    category: ["client", "insurance", "spam"].includes(item.category)
      ? item.category
      : "spam",
    urgency: ["high", "medium", "low"].includes(item.urgency)
      ? item.urgency
      : "low",
    actionRequired: Boolean(item.actionRequired),
    summaryTitle: String(item.summaryTitle || item.summary || "").trim(),
    summaryDetails: Array.isArray(item.summaryDetails)
      ? item.summaryDetails
          .map((detail: UnknownJSON) => String(detail).trim())
          .filter(Boolean)
          .slice(0, 6)
      : [],
    clientTags: Array.isArray(item.clientTags)
      ? ([
          ...new Set(
            item.clientTags.map((name: UnknownJSON) => String(name).trim()).filter(Boolean)
          ),
        ].slice(0, 6) as string[])
      : [],
    summary: String(item.summary || item.summaryTitle || "").trim(),
    recommendedAction: item.recommendedAction
      ? String(item.recommendedAction).trim()
      : null,
    draftResponse: item.draftResponse
      ? String(item.draftResponse).trim()
      : null,
  }));
}

/**
 * Analyze a batch of emails with retry logic (splits batch on failure).
 * @internal
 */
async function analyzeEmailBatch(
  emails: Email[],
  entities: EntityData
): Promise<AnalyzedEmail[]> {
  try {
    return await analyzeEmailBatchOnce(emails, entities);
  } catch (err) {
    if (emails.length === 1) throw err;
    const midpoint = Math.ceil(emails.length / 2);
    console.warn(
      `Retrying incomplete AI email batch as smaller groups: ${err instanceof Error ? err.message : String(err)}`
    );
    const halves = await Promise.all([
      analyzeEmailBatch(emails.slice(0, midpoint), entities),
      analyzeEmailBatch(emails.slice(midpoint), entities),
    ]);
    return halves.flat();
  }
}

/**
 * Analyze emails using AI with PII redaction.
 *
 * Processes emails in batches, redacting PII before sending to AI and
 * unredacting the responses.
 *
 * @param emails - Array of emails to analyze
 * @returns Promise resolving to array of analyzed email results
 */
export async function analyzeEmails(
  emails: Email[]
): Promise<AnalyzedEmail[]> {
  // Load entities once for all batches
  const entities = await loadEntities();

  // Split into batches
  const batches: Email[][] = [];
  for (let index = 0; index < emails.length; index += EMAIL_BATCH_SIZE) {
    batches.push(emails.slice(index, index + EMAIL_BATCH_SIZE));
  }

  // Process all batches
  const results = await Promise.all(
    batches.map((batch) => analyzeEmailBatch(batch, entities))
  );

  // Scan all final values for PII leaks (warn only, don't throw)
  for (const result of results.flat()) {
    try {
      scanText(result.summaryTitle, { throwOnHighSeverityMiss: false });
      for (const detail of result.summaryDetails) {
        scanText(detail, { throwOnHighSeverityMiss: false });
      }
      for (const tag of result.clientTags) {
        scanText(tag, { throwOnHighSeverityMiss: false });
      }
      if (result.recommendedAction) {
        scanText(result.recommendedAction, { throwOnHighSeverityMiss: false });
      }
      if (result.draftResponse) {
        scanText(result.draftResponse, { throwOnHighSeverityMiss: false });
      }
    } catch (err) {
      // Should never throw with throwOnHighSeverityMiss: false, but log just in case
      console.error("[analyzeEmails] scanText error:", err);
    }
  }

  return results.flat();
}

const translationCache = new Map<
  string,
  { summary: string; body: string }
>();

/**
 * Translate email content to the target language.
 *
 * Uses XML delimiters to avoid JSON parse failures. Results are cached
 * by emailId and targetLang.
 *
 * @param emailId - Unique identifier for caching
 * @param summary - Summary text to translate
 * @param body - Body text to translate
 * @param targetLang - Target language ("en" | "es" | "ko")
 * @returns Promise resolving to translated summary and body
 */
export async function translateEmailContent(
  emailId: string,
  summary: string,
  body: string,
  targetLang: "en" | "es" | "ko"
): Promise<{ summary: string; body: string }> {
  // Early return for English - no translation needed
  if (targetLang === "en") {
    return { summary, body };
  }

  // Cache key includes language to avoid collisions
  const cacheKey = `${emailId}:${targetLang}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  // Load entities for redaction
  const entities = await loadEntities();

  // Redact summary and body
  const summaryRedaction = redact(summary, entities);
  const bodyRedaction = redact(body, entities);

  // Merge token maps
  const tokenMap = new Map([
    ...summaryRedaction.tokenMap,
    ...bodyRedaction.tokenMap,
  ]);

  // Language-specific prompt
  const languageMap = {
    ko: "natural, professional Korean",
    es: "natural, professional Spanish (Español)",
  };
  const targetLanguage = languageMap[targetLang];

  const prompt = `Translate the following two text sections into ${targetLanguage}.

Place each translation inside the corresponding XML tags exactly as shown.
Do not add any text outside the XML tags.

<summary_translation>
[Translation of the SUMMARY below]
</summary_translation>
<body_translation>
[Translation of the BODY below]
</body_translation>

SUMMARY:
${summaryRedaction.redactedText}

BODY:
${bodyRedaction.redactedText}`;

  // Redact the entire prompt
  const finalRedaction = redact(prompt, entities);

  // Call AI with redacted text
  const aiResponse = await callAI(finalRedaction.redactedText, {
    timeoutMs: 60000,
  });

  // Unredact the AI response
  const { originalText: unredactedResponse } = unredact(aiResponse, tokenMap);

  // Parse XML response
  const summaryMatch = unredactedResponse.match(
    /<summary_translation>([\s\S]*?)<\/summary_translation>/
  );
  const bodyMatch = unredactedResponse.match(
    /<body_translation>([\s\S]*?)<\/body_translation>/
  );

  if (!summaryMatch || !bodyMatch) {
    console.error(
      "Translation parse failed. Raw response:",
      unredactedResponse.slice(0, 300)
    );
    throw new Error("Unexpected translation response format from AI model.");
  }

  const output = {
    summary: summaryMatch[1].trim(),
    body: bodyMatch[1].trim(),
  };

  // Scan final translations for PII leaks (warn only, don't throw)
  try {
    scanText(output.summary, { throwOnHighSeverityMiss: false });
    scanText(output.body, { throwOnHighSeverityMiss: false });
  } catch (err) {
    console.error("[translateEmailContent] scanText error:", err);
  }

  translationCache.set(cacheKey, output);
  return output;
}

const SCHEDULE_SYSTEM = `You are a scheduling assistant for Dr. Huy's acupuncture clinic. Extract scheduling information from each email.

All unspecified years are 2026. Convert written-out dates to ISO format:
"July twentieth" → "2026-07-20", "July twenty-first" → "2026-07-21", "July 22nd" → "2026-07-22", etc.

For each email return an object with:
- "emailId": the string ID provided in brackets (e.g. "sched-0")
- "type": "appointment" | "reschedule" | "cancellation" | "deadline" | "inquiry"
- "patientName": the patient's full name, or "Insurance" for insurance emails
- "date": "YYYY-MM-DD" or null if no date is mentioned
- "time": "HH:MM" in 24h format, or null
- "title": brief 5-8 word description of the event
- "urgency": "high" | "medium" | "low"
- "category": "client" | "insurance"

Return ONLY a valid JSON array, no markdown, no explanation.`;

/**
 * Analyze emails for scheduling information.
 *
 * Extracts appointment/deadline data with PII redaction.
 *
 * @param emails - Array of emails with id, sender, subject, body
 * @returns Promise resolving to array of scheduling results
 */
export async function analyzeSchedulingEmails(
  emails: SchedulingEmail[]
): Promise<SchedulingResult[]> {
  // Load entities for redaction
  const entities = await loadEntities();

  // Redact each email
  const redactedEmails = emails.map((e) => {
    const senderRedaction = redact(e.sender, entities);
    const subjectRedaction = redact(e.subject, entities);
    const bodyRedaction = redact(e.body, entities);

    return {
      id: e.id,
      redactedSender: senderRedaction.redactedText,
      redactedSubject: subjectRedaction.redactedText,
      redactedBody: bodyRedaction.redactedText,
      tokenMap: new Map([
        ...senderRedaction.tokenMap,
        ...subjectRedaction.tokenMap,
        ...bodyRedaction.tokenMap,
      ]),
    };
  });

  // Build the prompt with redacted content
  const emailBlocks = redactedEmails
    .map(
      (e) =>
        `[${e.id}]\nFrom: ${e.redactedSender}\nSubject: ${e.redactedSubject}\nBody:\n${e.redactedBody}`
    )
    .join("\n\n---\n\n");

  const prompt = `${SCHEDULE_SYSTEM}\n\nEmails:\n\n${emailBlocks}`;

  // Redact the entire prompt
  const finalRedaction = redact(prompt, entities);

  // Call AI with redacted text
  const aiResponse = await callAI(finalRedaction.redactedText, {
    systemPrompt: SCHEDULE_SYSTEM,
    jsonMode: true,
    timeoutMs: 60000,
  });

  // Unredact the AI response
  const { originalText: unredactedResponse } = unredact(
    aiResponse,
    finalRedaction.tokenMap
  );

  // Parse JSON response
  const jsonText = unredactedResponse.startsWith("```")
    ? unredactedResponse
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim()
    : unredactedResponse;

  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed))
    throw new Error("Schedule analysis did not return an array");

  // Validate and normalize results
  const results = parsed.map((item: UnknownJSON): SchedulingResult => ({
    id: String(item.emailId || ""),
    type: [
      "appointment",
      "reschedule",
      "cancellation",
      "deadline",
      "inquiry",
    ].includes(item.type)
      ? item.type
      : "inquiry",
    patientName: String(item.patientName || "Unknown"),
    date:
      item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null,
    time: item.time && /^\d{2}:\d{2}$/.test(item.time) ? item.time : null,
    title: String(item.title || "").trim(),
    urgency: ["high", "medium", "low"].includes(item.urgency)
      ? item.urgency
      : "medium",
    category: item.category === "insurance" ? "insurance" : "client",
  }));

  // Scan all final values for PII leaks (warn only, don't throw)
  for (const result of results) {
    try {
      scanText(result.patientName, { throwOnHighSeverityMiss: false });
      scanText(result.title, { throwOnHighSeverityMiss: false });
      if (result.date) scanText(result.date, { throwOnHighSeverityMiss: false });
      if (result.time) scanText(result.time, { throwOnHighSeverityMiss: false });
    } catch (err) {
      console.error("[analyzeSchedulingEmails] scanText error:", err);
    }
  }

  return results;
}

/**
 * Clear the translation cache.
 *
 * Useful for testing or when you want to force fresh translations.
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}
