/**
 * AI admin chatbot API with retrieval over clinic data.
 * HIPAA-critical: every AI call uses redact → callAI → unredact → scanText pipeline.
 * Raw PII must NEVER reach Groq.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadEntities, redact, unredact, scanText } from "@/lib/redaction";
import { callAI, AIProviderError } from "@/lib/ai/provider";
import { stripLeftoverTokens } from "@/lib/ai/analysisPostprocess";
import {
  searchEmails,
  searchPatients,
  searchDocuments,
  buildContext,
} from "@/lib/chat/retrieval";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type POSTRequestBody = {
  sessionId?: string;
  message: string;
};

type POSTResponseBody = {
  success?: boolean;
  sessionId?: string;
  answer?: string;
  retrievedCounts?: {
    emails: number;
    patients: number;
    documents: number;
  };
  error?: string;
};

type IntentResult = {
  searchTerms: string[];
  scope: "emails" | "patients" | "documents" | "all" | "none";
};

/**
 * POST /api/chat
 * Create or continue a chat session.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Guard: require GROQ_API_KEY
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json<POSTResponseBody>(
      {
        success: false,
        error: "AI chatbot is unavailable. Please try again later.",
      },
      { status: 500 }
    );
  }

  // Parse request body
  let sessionId: string | undefined;
  let userMessage: string;

  try {
    const body: POSTRequestBody = await request.json();
    if (typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json<POSTResponseBody>(
        {
          success: false,
          error: "Missing or invalid message in request body",
        },
        { status: 400 }
      );
    }
    sessionId = body.sessionId;
    userMessage = body.message.trim();
  } catch {
    return NextResponse.json<POSTResponseBody>(
      {
        success: false,
        error: "Invalid JSON in request body",
      },
      { status: 400 }
    );
  }

  // Create session if none exists
  let session;
  try {
    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) {
        return NextResponse.json<POSTResponseBody>(
          {
            success: false,
            error: "Session not found",
          },
          { status: 404 }
        );
      }
    } else {
      session = await prisma.chatSession.create({
        data: {},
      });
      sessionId = session.id;
    }
  } catch (err) {
    console.error("[chat] Failed to create/fetch session:", err);
    return NextResponse.json<POSTResponseBody>(
      {
        success: false,
        error: "Database error",
      },
      { status: 500 }
    );
  }

  // Persist user message
  try {
    await prisma.chatMessage.create({
      data: {
        sessionId: sessionId,
        role: "user",
        content: userMessage,
      },
    });
  } catch (err) {
    console.error("[chat] Failed to persist user message:", err);
    return NextResponse.json<POSTResponseBody>(
      {
        success: false,
        error: "Failed to save message",
      },
      { status: 500 }
    );
  }

  // Load entities for redaction
  const entities = await loadEntities();

  // === Fetch message history (last 4 messages for intent call) ===
  let intentHistory: { role: string; content: string }[] = [];
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 5, // 4 + 1 (the user message we just added)
      select: { role: true, content: true },
    });
    // Reverse to get chronological order, exclude the last one (current user message)
    intentHistory = messages.reverse().slice(0, -1);
  } catch (err) {
    console.error("[chat] Failed to fetch history for intent:", err);
    // Continue without history
  }

  // === CALL 1: Intent classification ===
  // Build conversation for intent call (includes history for context like "she")
  const intentConversationMessages: string[] = [];
  for (const msg of intentHistory) {
    intentConversationMessages.push(`${msg.role}: ${msg.content}`);
  }
  intentConversationMessages.push(`user: ${userMessage}`);

  const intentConversationText = intentConversationMessages.join("\n\n");
  const intentRedaction = redact(intentConversationText, entities);

  const INTENT_SYSTEM = `You are an intent classifier for a clinic admin chatbot.
The user is asking a question about clinic data (emails, patients, documents) or asking a general question.

Your task: determine what clinic data to retrieve to answer the question.
Respond with ONLY valid JSON (no markdown, no code fences):
{
  "searchTerms": ["term1", "term2"],
  "scope": "emails" | "patients" | "documents" | "all" | "none"
}

- searchTerms: 2-6 keywords to search for in the database (extract from user message)
- scope: which data to search
  - "emails" = search emails only
  - "patients" = search patients only
  - "documents" = search documents only
  - "all" = search all three (PREFER "all" when uncertain - names appear in both patients AND emails)
  - "none" = general question needing no clinic data

IMPORTANT: When a name is mentioned, ALWAYS use scope: "all" because:
- The person might be a patient OR mentioned in emails
- We need to search both to provide complete information

Examples:
User: "Show me emails about Blue Cross"
Response: {"searchTerms": ["Blue Cross"], "scope": "emails"}

User: "Find patient John Smith"
Response: {"searchTerms": ["John", "Smith"], "scope": "all"}

User: "What's the status of Alice Vance"
Response: {"searchTerms": ["Alice", "Vance"], "scope": "all"}

User: "What's our policy on billing?"
Response: {"searchTerms": [], "scope": "none"}

User: "Show me everything about authorization denials"
Response: {"searchTerms": ["authorization", "denials"], "scope": "all"}`;

  let intentResponse: string;
  try {
    intentResponse = await callAI(intentRedaction.redactedText, {
      systemPrompt: INTENT_SYSTEM,
      temperature: 0.2,
      jsonMode: true,
      timeoutMs: 30000,
    });
  } catch (err: unknown) {
    if (err instanceof AIProviderError && err.statusCode === 429) {
      return NextResponse.json<POSTResponseBody>(
        {
          success: false,
          error: "rate_limited",
        },
        { status: 429 }
      );
    }
    console.error("[chat] Intent AI call failed:", err);
    return NextResponse.json<POSTResponseBody>(
      {
        success: false,
        error: "AI analysis failed",
      },
      { status: 502 }
    );
  }

  // Parse intent result
  let intent: IntentResult;
  try {
    intent = JSON.parse(intentResponse);
    if (
      !Array.isArray(intent.searchTerms) ||
      !["emails", "patients", "documents", "all", "none"].includes(intent.scope)
    ) {
      throw new Error("Invalid intent structure");
    }
  } catch {
    console.error("[chat] Failed to parse intent response:", intentResponse);
    return NextResponse.json<POSTResponseBody>(
      {
        success: false,
        error: "Invalid AI response format",
      },
      { status: 500 }
    );
  }

  // FIX BUG A: Unredact search terms to get real names/values for Prisma queries
  // The DB is inside our trust boundary - redaction is only for what goes to Groq
  const unredactedSearchTerms: string[] = [];
  for (const term of intent.searchTerms) {
    // Check if term contains redaction tokens
    if (term.includes("{{") && term.includes("}}")) {
      // Unredact the term
      const { originalText } = unredact(term, intentRedaction.tokenMap);
      unredactedSearchTerms.push(originalText);
    } else {
      unredactedSearchTerms.push(term);
    }
  }

  // Also append all entity values from the user message's tokenMap
  // This ensures we catch names even if AI didn't extract them as search terms
  for (const [_token, value] of intentRedaction.tokenMap.entries()) {
    if (value.length <= 2) continue;

    // Add the full entity value if not already included
    const valueLower = value.toLowerCase();
    const alreadyIncluded = unredactedSearchTerms.some(
      (term) => term.toLowerCase().includes(valueLower) || valueLower.includes(term.toLowerCase())
    );
    if (!alreadyIncluded) {
      unredactedSearchTerms.push(value);
    }

    // ALSO split multi-word values into individual words
    // e.g. "Maria Santos" → ["Maria", "Santos"] for matching firstName/lastName columns
    const words = value.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 1) {
      for (const word of words) {
        const wordLower = word.toLowerCase();
        const wordAlreadyIncluded = unredactedSearchTerms.some(
          (term) => term.toLowerCase() === wordLower
        );
        if (!wordAlreadyIncluded) {
          unredactedSearchTerms.push(word);
        }
      }
    }
  }

  console.log("[chat] Intent - scope:", intent.scope, "| Search terms - original:", intent.searchTerms, "unredacted:", unredactedSearchTerms);

  // === Retrieval phase ===
  let retrievedEmails: Awaited<ReturnType<typeof searchEmails>> = [];
  let retrievedPatients: Awaited<ReturnType<typeof searchPatients>> = [];
  let retrievedDocuments: Awaited<ReturnType<typeof searchDocuments>> = [];

  if (intent.scope !== "none") {
    try {
      // Use UNREDACTED search terms for Prisma queries
      if (intent.scope === "emails" || intent.scope === "all") {
        retrievedEmails = await searchEmails(unredactedSearchTerms);
      }
      if (intent.scope === "patients" || intent.scope === "all") {
        retrievedPatients = await searchPatients(unredactedSearchTerms);
      }
      if (intent.scope === "documents" || intent.scope === "all") {
        retrievedDocuments = await searchDocuments(unredactedSearchTerms);
      }
    } catch (err) {
      console.error("[chat] Retrieval failed:", err);
      return NextResponse.json<POSTResponseBody>(
        {
          success: false,
          error: "Data retrieval failed",
        },
        { status: 500 }
      );
    }
  }

  const context = buildContext(
    retrievedEmails,
    retrievedPatients,
    retrievedDocuments
  );

  console.log("[chat] Built context length:", context.length, "chars");

  // === Fetch message history (last 6 messages) ===
  let history: { role: string; content: string }[] = [];
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 7, // 6 + 1 (the user message we just added)
      select: { role: true, content: true },
    });
    // Reverse to get chronological order, exclude the last one (current user message)
    history = messages.reverse().slice(0, -1);
  } catch (err) {
    console.error("[chat] Failed to fetch history:", err);
    // Continue without history
  }

  // === CALL 2: Answer generation ===
  // Build conversation for AI call 2
  const conversationMessages: string[] = [];
  for (const msg of history) {
    conversationMessages.push(`${msg.role}: ${msg.content}`);
  }
  conversationMessages.push(`user: ${userMessage}`);

  const conversationText = conversationMessages.join("\n\n");

  // FIX BUG B: Redact BOTH conversation and context together
  // This ensures entities from retrieved records are also redacted
  const fullPromptText = context
    ? `CLINIC DATA CONTEXT:\n${context}\n\nCONVERSATION:\n${conversationText}`
    : conversationText;

  const fullRedaction = redact(fullPromptText, entities);

  console.log("[chat] Redacted prompt length:", fullRedaction.redactedText.length, "chars, tokens:", fullRedaction.tokenMap.size);

  const ANSWER_SYSTEM = `You are a clinic admin assistant for Dr. Song's acupuncture clinic.

Answer naturally as the clinic's assistant. Never refer to "the provided data", "the context", or "the records I can see"—just state the information.

If the asked-for detail is present in the clinic data below, answer it directly and stop. Only mention missing information when the specific detail requested is genuinely absent from the clinic data. Never invent data not shown below.

Placeholder tokens like {{PATIENT_NAME_1}}, {{DOB_2}}, etc. are privacy placeholders that refer to real people—treat identical tokens as the same person.

Be concise, professional, and use markdown for formatting. Use headers only for multi-part answers; single-fact answers should be one or two plain sentences.`;

  let answerResponse: string;
  try {
    answerResponse = await callAI(fullRedaction.redactedText, {
      systemPrompt: ANSWER_SYSTEM,
      temperature: 0.2,
      jsonMode: false,
      timeoutMs: 45000,
    });
  } catch (err: unknown) {
    if (err instanceof AIProviderError && err.statusCode === 429) {
      return NextResponse.json<POSTResponseBody>(
        {
          success: false,
          error: "rate_limited",
        },
        { status: 429 }
      );
    }
    console.error("[chat] Answer AI call failed:", err);
    return NextResponse.json<POSTResponseBody>(
      {
        success: false,
        error: "AI analysis failed",
      },
      { status: 502 }
    );
  }

  // Unredact answer using the full tokenMap (includes entities from context + conversation)
  const { originalText: unredactedAnswer } = unredact(
    answerResponse,
    fullRedaction.tokenMap
  );

  // Strip leftover tokens
  const cleanedAnswer = stripLeftoverTokens(unredactedAnswer);

  // Scan for missed PII (warn only, don't throw)
  try {
    scanText(cleanedAnswer, { throwOnHighSeverityMiss: false });
  } catch (err) {
    console.error("[chat] scanText error:", err);
  }

  // Persist assistant message
  try {
    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: cleanedAnswer,
      },
    });
  } catch (err) {
    console.error("[chat] Failed to persist assistant message:", err);
    // Continue - we still have the answer
  }

  return NextResponse.json<POSTResponseBody>({
    success: true,
    sessionId,
    answer: cleanedAnswer,
    retrievedCounts: {
      emails: retrievedEmails.length,
      patients: retrievedPatients.length,
      documents: retrievedDocuments.length,
    },
  });
}

/**
 * GET /api/chat?sessionId=...
 * Fetch messages for a session.
 *
 * GET /api/chat (no params)
 * Fetch session list (newest first).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (sessionId) {
    // Fetch messages for session
    try {
      const messages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      });

      return NextResponse.json({ messages });
    } catch (err) {
      console.error("[chat] Failed to fetch messages:", err);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }
  } else {
    // Fetch session list
    try {
      const sessions = await prisma.chatSession.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({ sessions });
    } catch (err) {
      console.error("[chat] Failed to fetch sessions:", err);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }
  }
}
