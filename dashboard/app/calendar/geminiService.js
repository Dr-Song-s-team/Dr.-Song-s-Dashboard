const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 60000;
const EMAIL_BATCH_SIZE = 25;

function getModel() {
  if (!model) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not set in environment');
    genAI = new GoogleGenerativeAI(key);
    model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  }
  return model;
}

async function generateContent(prompt) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Gemini request timed out after ${GEMINI_TIMEOUT_MS}ms`)),
      GEMINI_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([getModel().generateContent(prompt), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

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

async function analyzeEmailBatchOnce(emails) {
  const emailBlocks = emails
    .map(
      (e, i) =>
        `[${i}]\nFrom: ${e.sender}\nSubject: ${e.subject}\nBody:\n${e.body}`
    )
    .join('\n\n---\n\n');

  const prompt = `${ANALYSIS_SYSTEM}\n\nEmails:\n\n${emailBlocks}`;

  const result = await generateContent(prompt);
  const text = result.response.text().trim();

  const jsonText = text.startsWith('```')
    ? text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    : text;

  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed) || parsed.length !== emails.length) {
    throw new Error(`Expected ${emails.length} results, got ${parsed.length}`);
  }

  return parsed.map(item => ({
    category: ['client', 'insurance', 'spam'].includes(item.category)
      ? item.category
      : 'spam',
    urgency: ['high', 'medium', 'low'].includes(item.urgency)
      ? item.urgency
      : 'low',
    actionRequired: Boolean(item.actionRequired),
    summaryTitle: String(item.summaryTitle || item.summary || '').trim(),
    summaryDetails: Array.isArray(item.summaryDetails)
      ? item.summaryDetails.map(detail => String(detail).trim()).filter(Boolean).slice(0, 6)
      : [],
    clientTags: Array.isArray(item.clientTags)
      ? [...new Set(item.clientTags.map(name => String(name).trim()).filter(Boolean))].slice(0, 6)
      : [],
    summary: String(item.summary || item.summaryTitle || '').trim(),
    recommendedAction: item.recommendedAction
      ? String(item.recommendedAction).trim()
      : null,
    draftResponse: item.draftResponse
      ? String(item.draftResponse).trim()
      : null,
  }));
}

async function analyzeEmailBatch(emails) {
  try {
    return await analyzeEmailBatchOnce(emails);
  } catch (err) {
    if (emails.length === 1) throw err;
    const midpoint = Math.ceil(emails.length / 2);
    console.warn(`Retrying incomplete Gemini email batch as smaller groups: ${err.message}`);
    const halves = await Promise.all([
      analyzeEmailBatch(emails.slice(0, midpoint)),
      analyzeEmailBatch(emails.slice(midpoint)),
    ]);
    return halves.flat();
  }
}

async function analyzeEmails(emails) {
  const batches = [];
  for (let index = 0; index < emails.length; index += EMAIL_BATCH_SIZE) {
    batches.push(emails.slice(index, index + EMAIL_BATCH_SIZE));
  }
  const results = await Promise.all(batches.map(analyzeEmailBatch));
  return results.flat();
}

const translationCache = new Map();

async function translateEmailContent(emailId, summary, body) {
  if (translationCache.has(emailId)) {
    return translationCache.get(emailId);
  }

  // Use XML delimiters to avoid JSON parse failures caused by special characters
  // in multi-line email bodies (quotes, newlines, etc.)
  const prompt = `Translate the following two text sections into natural, professional Korean.

Place each Korean translation inside the corresponding XML tags exactly as shown.
Do not add any text outside the XML tags.

<summary_translation>
[Korean translation of the SUMMARY below]
</summary_translation>
<body_translation>
[Korean translation of the BODY below]
</body_translation>

SUMMARY:
${summary}

BODY:
${body}`;

  const result = await generateContent(prompt);
  const text = result.response.text();

  const summaryMatch = text.match(/<summary_translation>([\s\S]*?)<\/summary_translation>/);
  const bodyMatch    = text.match(/<body_translation>([\s\S]*?)<\/body_translation>/);

  if (!summaryMatch || !bodyMatch) {
    console.error('Translation parse failed. Raw response:', text.slice(0, 300));
    throw new Error('Unexpected translation response format from AI model.');
  }

  const output = {
    summary: summaryMatch[1].trim(),
    body:    bodyMatch[1].trim(),
  };

  translationCache.set(emailId, output);
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

async function analyzeSchedulingEmails(emails) {
  const emailBlocks = emails
    .map(e => `[${e.id}]\nFrom: ${e.sender}\nSubject: ${e.subject}\nBody:\n${e.body}`)
    .join('\n\n---\n\n');

  const prompt = `${SCHEDULE_SYSTEM}\n\nEmails:\n\n${emailBlocks}`;
  const result = await generateContent(prompt);
  const text = result.response.text().trim();

  const jsonText = text.startsWith('```')
    ? text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    : text;

  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed)) throw new Error('Schedule analysis did not return an array');

  return parsed.map(item => ({
    emailId:     String(item.emailId || ''),
    type:        ['appointment','reschedule','cancellation','deadline','inquiry'].includes(item.type)
                   ? item.type : 'inquiry',
    patientName: String(item.patientName || 'Unknown'),
    date:        item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null,
    time:        item.time && /^\d{2}:\d{2}$/.test(item.time) ? item.time : null,
    title:       String(item.title || '').trim(),
    urgency:     ['high','medium','low'].includes(item.urgency) ? item.urgency : 'medium',
    category:    item.category === 'insurance' ? 'insurance' : 'client',
  }));
}

function clearTranslationCache() {
  translationCache.clear();
}

module.exports = { analyzeEmails, translateEmailContent, clearTranslationCache, analyzeSchedulingEmails };
