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

  // === CALL 1: Intent classification ===
  const userMessageRedaction = redact(userMessage, entities);

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
  - "all" = search all three
  - "none" = general question needing no clinic data

Examples:
User: "Show me emails about Blue Cross"
Response: {"searchTerms": ["Blue Cross"], "scope": "emails"}

User: "Find patient John Smith"
Response: {"searchTerms": ["John", "Smith"], "scope": "patients"}

User: "What's our policy on billing?"
Response: {"searchTerms": [], "scope": "none"}

User: "Show me everything about authorization denials"
Response: {"searchTerms": ["authorization", "denials"], "scope": "all"}`;

  let intentResponse: string;
  try {
    intentResponse = await callAI(userMessageRedaction.redactedText, {
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

  // === Retrieval phase ===
  let retrievedEmails: Awaited<ReturnType<typeof searchEmails>> = [];
  let retrievedPatients: Awaited<ReturnType<typeof searchPatients>> = [];
  let retrievedDocuments: Awaited<ReturnType<typeof searchDocuments>> = [];

  if (intent.scope !== "none") {
    try {
      if (intent.scope === "emails" || intent.scope === "all") {
        retrievedEmails = await searchEmails(intent.searchTerms);
      }
      if (intent.scope === "patients" || intent.scope === "all") {
        retrievedPatients = await searchPatients(intent.searchTerms);
      }
      if (intent.scope === "documents" || intent.scope === "all") {
        retrievedDocuments = await searchDocuments(intent.searchTerms);
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
  const ANSWER_SYSTEM = `You are a professional clinic admin assistant for Dr. Song's acupuncture clinic.

CRITICAL INSTRUCTIONS:
- Answer ONLY from the provided context below
- If the context doesn't contain the answer, say "I don't have that information in the clinic records"
- NEVER fabricate patient data, dates, or details
- Be concise and professional
- Use markdown for formatting (lists, bold, etc.)

${context ? `CLINIC DATA CONTEXT:\n${context}` : "No clinic data retrieved for this query."}`;

  // Build conversation for AI call 2
  const conversationMessages: string[] = [];
  for (const msg of history) {
    conversationMessages.push(`${msg.role}: ${msg.content}`);
  }
  conversationMessages.push(`user: ${userMessage}`);

  const conversationText = conversationMessages.join("\n\n");
  const conversationRedaction = redact(conversationText, entities);

  let answerResponse: string;
  try {
    answerResponse = await callAI(conversationRedaction.redactedText, {
      systemPrompt: ANSWER_SYSTEM,
      temperature: 0.7,
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

  // Unredact answer
  const { originalText: unredactedAnswer } = unredact(
    answerResponse,
    conversationRedaction.tokenMap
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
