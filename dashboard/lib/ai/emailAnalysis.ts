/**
 * AI service for email analysis and translation.
 * Routes all AI calls through the Groq provider with PII redaction.
 *
 * This replaces geminiService.js — all function signatures and return shapes
 * are preserved for backward compatibility with existing calendar UI code.
 */

import { callAI, CallAIOptions } from "@/lib/ai/provider";
import { loadEntities, redact, unredact, scanText } from "@/lib/redaction";
import type { EntityData, RedactedText } from "@/lib/redaction";

const EMAIL_BATCH_SIZE = 3;

const MAX_EMAIL_BODY_LENGTH = 4000;

function truncateEmailBody(body: string): string {
  if (body.length <= MAX_EMAIL_BODY_LENGTH) {
    return body;
  }

  const truncated = body.slice(0, MAX_EMAIL_BODY_LENGTH);

  return `${truncated}

[EMAIL BODY TRUNCATED — ONLY THE FIRST ${MAX_EMAIL_BODY_LENGTH} CHARACTERS WERE PROVIDED]`;
}

// const ANALYSIS_SYSTEM = `You are an AI assistant for Dr. Song, a licensed acupuncturist. Analyze clinic emails and return a JSON array.

// For each input email, return EXACTLY ONE object with:
// {
// "category": "client" | "insurance" | "spam"
// "urgency": "high" | "medium" | "low"
// "actionRequired": true | false
// "summaryTitle": an 8-14 word plain-language gist of what the email is about
// "summaryDetails": an array of 3-6 concise, easy-to-understand detail strings. Include concrete names, dates, times, requests, deadlines, and consequences when present.
// - "clientTags": an array of every patient/client full name mentioned or directly associated with the email. For a patient email, include the sender's name. Use an empty array only when no client is identifiable.
// - "recommendedActions": an array of short staff tasks including appointments, follow-ups, and forms, or null if none needed
// - "dueDate": ISO datetime string for the task deadline, or null
// - "dueTime": time in format "HH:MM AM/PM", or null

// Each task should:
// - begin with a verb
// - be concise (3–10 words)
// - describe one concrete action
// - be independently actionable

// Examples:
// [
//   "Call patient to confirm appointment",
//   "Upload insurance documentation",
//   "Verify coverage with Blue Shield",
//   "Schedule follow-up visit"
// ]

// For each recommended action:
// - Extract the actual deadline mentioned in the email.
// - If no deadline exists, estimate a reasonable due date:
//   - high urgency: within 1 day
//   - medium urgency: within 3 days
//   - low urgency: within 7 days

// Return dueDate as:
// YYYY-MM-DD

// Return dueTime as:
// HH:MM AM/PM

// - "draftResponse": a warm, professional response the clinic can edit and send. Address the sender by first name when appropriate, directly acknowledge their request, and state the next step. Use null for spam or messages that should not receive a reply.

// Urgency rules:
// - "high": immediate deadline or consequence (claim denial risk, documentation due <14 days, urgent medical concern)
// - "medium": needs attention soon (patient questions needing reply, new intake requests, doc requests with reasonable timeline)
// - "low": informational only (progress updates, payment confirmations, spam/marketing)

// Category rules:
// - "client": emails from patients about care, symptoms, appointments, or billing
// - "insurance": emails from insurance companies about coverage, claims, documentation
// - "spam": marketing, promotional, vendor, or irrelevant emails

// Length requirements:
// - summaryTitle: 8-14 words
// - summaryDetails: 3-6 items, each under 20 words
// - recommendedActions: 1-5 items, each 3-10 words
// - draftResponse: 60-120 words

// Return ONLY a valid JSON array with no markdown, no explanation.`;

const ANALYSIS_SYSTEM = `
You analyze emails for Dr. Song's acupuncture clinic.

Return EXACTLY ONE JSON OBJECT in this shape:

{
  "emails": [
    {
      "category": "client" | "insurance" | "spam",
      "urgency": "high" | "medium" | "low",
      "actionRequired": true | false,
      "summaryTitle": "string",
      "summaryDetails": ["string"],
      "clientTags": ["string"],
      "recommendedActions": ["string"] | null,
      "dueDate": "YYYY-MM-DD" | null,
      "dueTime": "HH:MM AM/PM" | null,
      "draftResponse": "string" | null
    }
  ]
}

The "emails" array must contain EXACTLY ONE object for each input email, with
these fields:

{
  "category": "client" | "insurance" | "spam",
  "urgency": "high" | "medium" | "low",
  "actionRequired": true | false,
  "summaryTitle": "string",
  "summaryDetails": ["string"],
  "clientTags": ["string"],
  "recommendedActions": ["string"] | null,
  "dueDate": "YYYY-MM-DD" | null,
  "dueTime": "HH:MM AM/PM" | null,
  "draftResponse": "string" | null
}

IMPORTANT JSON RULES:

- Return valid JSON only.
- Do not use Markdown.
- Do not use code fences.
- Do not add commentary before or after the JSON.
- Use double quotes around every JSON key and string.
- Never use a backslash before a colon.
- Never include trailing commas.
- Use true and false for booleans.
- Use null for missing values.
- The "emails" array length MUST equal the number of input emails.
- Preserve the input order.

FIELD RULES:

category:
- "client" = patient/client email about care, symptoms, appointments, or billing
- "insurance" = insurance company email about coverage, claims, or documentation
- "spam" = marketing, promotional, vendor, job, newsletter, or irrelevant email

urgency:
- "high" = immediate deadline, claim denial risk, documentation due within 14 days, or urgent medical concern
- "medium" = requires staff attention soon
- "low" = informational, completed transaction, newsletter, marketing, or spam

actionRequired:
- true if clinic staff needs to perform an action
- false if no action is needed

summaryTitle:
- Write exactly two complete, plain-language sentences (20-35 words total).
- Give a detailed but scannable account of the email's main request or outcome.
- Include the relevant sender or patient, dates or times, deadlines, requested documents or actions, and consequences when those facts are present.
- Do not invent facts or repeat the same information in both sentences.

summaryDetails:
- 3-6 concise strings
- Include important names, dates, times, requests, deadlines, and consequences
- Do not repeat unnecessary information

clientTags:
- Include every patient/client full name mentioned or directly associated with the email
- For a patient email, include the sender's name
- For insurance emails, include identifiable patient names
- For spam, return []

recommendedActions:
- If staff needs to do something, return an array of concrete actions
- Each action must begin with a verb
- Each action must be 3-10 words
- Each action must describe exactly one task
- If no action is needed, return null

Examples:
[
  "Call patient to confirm appointment",
  "Upload insurance documentation",
  "Verify coverage with insurance",
  "Schedule follow-up visit"
]

dueDate:
- Use the actual deadline mentioned in the email when available
- Format exactly as YYYY-MM-DD
- If there is no task deadline, put it a week from the task creation, but do not use null

dueTime:
- Use the actual deadline time when explicitly stated
- Format exactly as HH:MM AM/PM
- If no deadline time is stated, use null
- Do not invent a time

draftResponse:
- For client or insurance emails requiring a response, write a warm, professional response
- Address the sender by first name when appropriate
- Acknowledge their request
- State the next step
- Keep it concise
- Return null for spam or emails that do not require a response

Remember:
OUTPUT ONLY THE VALID JSON OBJECT.
`


export interface Email {
  id: string;
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

  recommendedActions: string[] | null;

  dueDate: string | null;
  dueTime: string | null;

  draftResponse: string | null;
}

// Type for unknown JSON responses from AI
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnknownJSON = any;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAIWithRetry(
  prompt: RedactedText,
  options: CallAIOptions,
  maxRetries = 3
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callAI(prompt, options);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : String(err);

      const lowerMessage = message.toLowerCase();

      const isRateLimit =
        message.includes("429") ||
        lowerMessage.includes("rate limit") ||
        lowerMessage.includes("rate_limit_exceeded");

      if (!isRateLimit) {
        throw err;
      }

      if (attempt === maxRetries) {
        throw err;
      }

      // Groq often provides:
      // "Please try again in 18.112s"
      const retryMatch = message.match(
        /try again in\s+([\d.]+)s/i
      );

      let delay: number;

      if (retryMatch) {
        const retrySeconds = Number(retryMatch[1]);

        delay =
          Math.ceil(retrySeconds * 1000) +
          2000;
      } else {
        delay =
          5000 *
          Math.pow(2, attempt);
      }

      console.warn(
        `Groq rate limit hit. ` +
        `Waiting ${delay}ms before retry ` +
        `${attempt + 1}/${maxRetries}...`
      );

      await sleep(delay);
    }
  }

  throw new Error(
    "AI request failed after retries"
  );
}



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
  const bodyRedaction = redact(
    truncateEmailBody(e.body),
    entities
  );

  return {
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
    (e, i) =>
      `[${i}]
From: ${e.redactedSender}
Subject: ${e.redactedSubject}
Body:
${e.redactedBody}`
  )
  .join("\n\n---\n\n");

const prompt = `Emails:\n\n${emailBlocks}`;

const tokenMap = new Map<string, string>();

for (const email of redactedEmails) {
  for (const [key, value] of email.tokenMap) {
    tokenMap.set(key, value);
  }
}

  // Redact the entire prompt (to get the RedactedText branded type)
  const finalRedaction = redact(prompt, entities);

  // Call AI with redacted text — jsonMode for reliable Groq output
  const aiResponse = await callAIWithRetry(
  finalRedaction.redactedText,
  {
    systemPrompt: ANALYSIS_SYSTEM,
    jsonMode: true,
    timeoutMs: 60000,
  }
);

  // Unredact the AI response
  const { originalText: unredactedResponse } =
  unredact(aiResponse, tokenMap);
  // Parse JSON response
  const jsonText = unredactedResponse.startsWith("```")
    ? unredactedResponse
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim()
    : unredactedResponse;

  const parsed = JSON.parse(jsonText);

  // Accept both { emails: [...] } (preferred) and bare [...] (legacy fallback)
  const emailResults: UnknownJSON[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.emails)
    ? parsed.emails
    : null;

  if (!emailResults || emailResults.length !== emails.length) {
    throw new Error(
      `Expected ${emails.length} results, got ${
        emailResults ? emailResults.length : "invalid response"
      }`
    );
  }

  // Validate and normalize each result
  return emailResults.map((item: UnknownJSON): AnalyzedEmail => ({
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
    recommendedActions: Array.isArray(item.recommendedActions)
  ? [
      ...new Set<string>(
        item.recommendedActions
          .map((action: UnknownJSON): string => String(action).trim())
          .filter(Boolean)
      ),
    ].slice(0, 10)
  : null,
    draftResponse: item.draftResponse
      ? String(item.draftResponse).trim()
      : null,
      dueDate:
  item.dueDate &&
  /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)
    ? item.dueDate
    : null,

dueTime:
  item.dueTime && /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i.test(
    String(item.dueTime)
  )
    ? String(item.dueTime).trim().toUpperCase()
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
    if (emails.length === 1) {
      throw err;
    }

    const message =
      err instanceof Error
        ? err.message.toLowerCase()
        : String(err).toLowerCase();

    // Rate limits should be handled by callAIWithRetry,
    // not by splitting the batch.
    if (
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("rate_limit_exceeded")
    ) {
      throw err;
    }

    // Handle 413 Payload Too Large by splitting the batch
    const is413 =
      message.includes("413") ||
      message.includes("payload too large") ||
      message.includes("request entity too large");

    if (is413) {
      console.warn(
        `413 Payload Too Large. Splitting batch of ${emails.length} emails in half.`
      );
    } else {
      console.warn(
        `AI batch failed. Retrying as smaller groups: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    const midpoint = Math.ceil(emails.length / 2);

    const firstHalf = await analyzeEmailBatch(
      emails.slice(0, midpoint),
      entities
    );
    const secondHalf = await analyzeEmailBatch(
      emails.slice(midpoint),
      entities
    );

    return [...firstHalf, ...secondHalf];
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
  const results = [];

for (const batch of batches) {

  const result =
    await analyzeEmailBatch(
      batch,
      entities
    );

  results.push(result);

  // prevent rate limits
  await sleep(1000);
}

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
      if (result.recommendedActions) {
        for (const action of result.recommendedActions) {
          scanText(action, {
            throwOnHighSeverityMiss: false,
          });
        }
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
 * Translate email content to target language.
 *
 * Uses XML delimiters to avoid JSON parse failures. Results are cached
 * by emailId + language.
 *
 * @param emailId - Unique identifier for caching
 * @param summary - English summary text to translate
 * @param body - English body text to translate
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
  const bodyRedaction = redact(
    truncateEmailBody(body),
    entities
  );

  // Merge token maps
  const _tokenMap = new Map<string, string>([
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
  const { originalText: unredactedResponse } = unredact(
    aiResponse,
    finalRedaction.tokenMap
  );

  // Remove accidental Markdown code fences if the model still adds them.
  const cleanedResponse = unredactedResponse
    .replace(/^```(?:xml|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Parse XML response
  const summaryMatch = cleanedResponse.match(
    /<summary_translation>\s*([\s\S]*?)\s*<\/summary_translation>/i
  );

  const bodyMatch = cleanedResponse.match(
    /<body_translation>\s*([\s\S]*?)\s*<\/body_translation>/i
  );

  if (!summaryMatch || !bodyMatch) {
    console.error(
      "[translateEmailContent] Translation parse failed."
    );
    console.error(
      "[translateEmailContent] Cleaned response:",
      cleanedResponse.slice(0, 300)
    );
    throw new Error(
      "Unexpected translation response format from AI model."
    );
  }

  const output = {
    summary: summaryMatch[1].trim(),
    body: bodyMatch[1].trim(),
  };

  // Scan final translations for PII leaks (warn only, don't throw)
  try {
    scanText(output.summary, {
      throwOnHighSeverityMiss: false,
    });

    scanText(output.body, {
      throwOnHighSeverityMiss: false,
    });
  } catch (err) {
    console.error(
      "[translateEmailContent] scanText error:",
      err
    );
  }

  translationCache.set(cacheKey, output);

  return output;
}

/**
 * Clear the translation cache.
 *
 * Useful for testing or when you want to force fresh translations.
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}
