/**
 * Tests for chat API route with mocked prisma and callAI.
 * Follows the pattern from app/api/email/[id]/metrics/__tests__/route.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "../route";
import { prisma } from "@/lib/prisma";
import { callAI } from "@/lib/ai/provider";
import { loadEntities } from "@/lib/redaction";
import { scanText } from "@/lib/redaction";

// Mock all dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ai/provider", () => ({
  callAI: vi.fn(),
  AIProviderError: class AIProviderError extends Error {
    constructor(message: string, public statusCode?: number) {
      super(message);
      this.name = "AIProviderError";
    }
  },
}));

vi.mock("@/lib/redaction", () => ({
  loadEntities: vi.fn(),
  redact: vi.fn(),
  unredact: vi.fn(),
  scanText: vi.fn(),
}));

// Mock the retrieval functions
vi.mock("@/lib/chat/retrieval", () => ({
  searchEmails: vi.fn(),
  searchPatients: vi.fn(),
  searchDocuments: vi.fn(),
  buildContext: vi.fn(),
}));

const { AIProviderError } = await import("@/lib/ai/provider");

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(sessionId?: string): Request {
  const url = sessionId
    ? `http://localhost/api/chat?sessionId=${sessionId}`
    : "http://localhost/api/chat";
  return new Request(url, { method: "GET" });
}

describe("POST /api/chat", () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.GROQ_API_KEY = "test-api-key";

    // Default mock implementations
    vi.mocked(loadEntities).mockResolvedValue({
      patientFirstNames: [],
      patientLastNames: [],
      patientFullNames: [],
      memberIds: [],
    });
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([]);

    // Mock redact to return the same text (simplified for testing)
    const redactionModule = await import("@/lib/redaction");
    vi.mocked(redactionModule.redact).mockImplementation((text) => ({
      redactedText: text as never,
      tokenMap: new Map(),
      matches: [],
    }));

    // Mock unredact to return the same text
    vi.mocked(redactionModule.unredact).mockImplementation((text) => ({
      originalText: text,
      unknownTokens: [],
    }));

    // Mock buildContext to return empty string
    const retrievalModule = await import("@/lib/chat/retrieval");
    vi.mocked(retrievalModule.buildContext).mockReturnValue("");
    vi.mocked(retrievalModule.searchEmails).mockResolvedValue([]);
    vi.mocked(retrievalModule.searchPatients).mockResolvedValue([]);
    vi.mocked(retrievalModule.searchDocuments).mockResolvedValue([]);
  });

  it("should create new session and return answer on first message", async () => {
    const newSession = { id: "session-1", title: null, createdAt: new Date(), updatedAt: new Date() };

    vi.mocked(prisma.chatSession.create).mockResolvedValue(newSession as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    // Mock AI responses: intent then answer
    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: [], scope: "none" }))
      .mockResolvedValueOnce("This is the answer");

    const req = makePostRequest({ message: "What is your policy?" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.sessionId).toBe("session-1");
    expect(data.answer).toBe("This is the answer");
    expect(data.retrievedCounts).toEqual({ emails: 0, patients: 0, documents: 0 });

    // Verify session was created
    expect(prisma.chatSession.create).toHaveBeenCalledOnce();

    // Verify messages were persisted (user + assistant)
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(2);

    // Verify scanText was called
    expect(scanText).toHaveBeenCalledWith("This is the answer", { throwOnHighSeverityMiss: false });
  });

  it("should use existing session when sessionId is provided", async () => {
    const existingSession = { id: "existing-session", title: null, createdAt: new Date(), updatedAt: new Date() };

    vi.mocked(prisma.chatSession.findUnique).mockResolvedValue(existingSession as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: [], scope: "none" }))
      .mockResolvedValueOnce("Answer to follow-up");

    const req = makePostRequest({ sessionId: "existing-session", message: "Follow-up question" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sessionId).toBe("existing-session");
    expect(data.answer).toBe("Answer to follow-up");

    // Should not create new session
    expect(prisma.chatSession.create).not.toHaveBeenCalled();
    expect(prisma.chatSession.findUnique).toHaveBeenCalledWith({ where: { id: "existing-session" } });
  });

  it("should return 404 when sessionId does not exist", async () => {
    vi.mocked(prisma.chatSession.findUnique).mockResolvedValue(null);

    const req = makePostRequest({ sessionId: "nonexistent", message: "Test" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Session not found");
  });

  it("should return 400 when message is missing", async () => {
    const req = makePostRequest({});
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/missing or invalid message/i);
  });

  it("should return 400 when message is empty string", async () => {
    const req = makePostRequest({ message: "   " });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/missing or invalid message/i);
  });

  it("should return 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/invalid json/i);
  });

  it("should return 500 when GROQ_API_KEY is missing", async () => {
    delete process.env.GROQ_API_KEY;

    const req = makePostRequest({ message: "Test" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toMatch(/unavailable/i);
  });

  it("should return 429 on rate limit error", async () => {
    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    // Mock rate limit error
    vi.mocked(callAI).mockRejectedValueOnce(new AIProviderError("Rate limit", 429));

    const req = makePostRequest({ message: "Test" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBe("rate_limited");
  });

  it("should return 502 on AI call failure (not rate limit)", async () => {
    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    vi.mocked(callAI).mockRejectedValueOnce(new Error("AI service down"));

    const req = makePostRequest({ message: "Test" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toMatch(/ai analysis failed/i);
  });

  it("should trigger retrieval when scope is 'emails'", async () => {
    const retrievalModule = await import("@/lib/chat/retrieval");

    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: ["billing"], scope: "emails" }))
      .mockResolvedValueOnce("Found billing emails");

    vi.mocked(retrievalModule.searchEmails).mockResolvedValue([{} as never]);
    vi.mocked(retrievalModule.buildContext).mockReturnValue("Email context");

    const req = makePostRequest({ message: "Show billing emails" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(retrievalModule.searchEmails).toHaveBeenCalledWith(["billing"]);
    expect(retrievalModule.buildContext).toHaveBeenCalled();
    expect(data.retrievedCounts?.emails).toBe(1);
  });

  it("should not trigger retrieval when scope is 'none'", async () => {
    const retrievalModule = await import("@/lib/chat/retrieval");

    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: [], scope: "none" }))
      .mockResolvedValueOnce("General answer");

    const req = makePostRequest({ message: "What is HIPAA?" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(retrievalModule.searchEmails).not.toHaveBeenCalled();
    expect(retrievalModule.searchPatients).not.toHaveBeenCalled();
    expect(retrievalModule.searchDocuments).not.toHaveBeenCalled();
    expect(data.retrievedCounts).toEqual({ emails: 0, patients: 0, documents: 0 });
  });

  it("should pass REAL patient name to Prisma, not redaction tokens, and split multi-word names", async () => {
    const retrievalModule = await import("@/lib/chat/retrieval");
    const redactionModule = await import("@/lib/redaction");

    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    // Mock redact to replace "Alice Vance" with a token
    vi.mocked(redactionModule.redact).mockImplementation((text) => {
      const tokenMap = new Map<string, string>();
      let redactedText = text;

      if (text.includes("Alice Vance")) {
        tokenMap.set("{{PERSON_1}}", "Alice Vance");
        redactedText = text.replace(/Alice Vance/g, "{{PERSON_1}}");
      }

      return {
        redactedText: redactedText as never,
        tokenMap,
        matches: [],
      };
    });

    // Mock unredact to restore original text
    vi.mocked(redactionModule.unredact).mockImplementation((text, tokenMap) => ({
      originalText: text.replace(/\{\{PERSON_1\}\}/g, tokenMap.get("{{PERSON_1}}") || "{{PERSON_1}}"),
      unknownTokens: [],
    }));

    // AI returns tokens in search terms (BUG A scenario)
    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: ["{{PERSON_1}}"], scope: "patients" }))
      .mockResolvedValueOnce("Patient info");

    vi.mocked(retrievalModule.searchPatients).mockResolvedValue([]);

    const req = makePostRequest({ message: "What's the status of Alice Vance" });
    const res = await POST(req);

    expect(res.status).toBe(200);

    // CRITICAL: searchPatients should receive "Alice Vance", not "{{PERSON_1}}"
    expect(retrievalModule.searchPatients).toHaveBeenCalled();
    const searchArgs = vi.mocked(retrievalModule.searchPatients).mock.calls[0][0];

    // Should include the real name "Alice Vance"
    expect(searchArgs).toContain("Alice Vance");
    // Should NOT include the token
    expect(searchArgs).not.toContain("{{PERSON_1}}");
    // NEW: Should also include split words for firstName/lastName matching
    expect(searchArgs).toContain("Alice");
    expect(searchArgs).toContain("Vance");
  });

  it("should return 500 on invalid intent JSON", async () => {
    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    vi.mocked(callAI).mockResolvedValueOnce("not valid json");

    const req = makePostRequest({ message: "Test" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toMatch(/invalid ai response/i);
  });
});

describe("GET /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return messages for a session", async () => {
    const messages = [
      { id: "msg-1", role: "user", content: "Hello", createdAt: new Date("2024-01-01") },
      { id: "msg-2", role: "assistant", content: "Hi there", createdAt: new Date("2024-01-02") },
    ];

    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue(messages as never);

    const req = makeGetRequest("session-1");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // Dates get serialized to strings in JSON
    expect(data.messages).toEqual([
      { id: "msg-1", role: "user", content: "Hello", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "msg-2", role: "assistant", content: "Hi there", createdAt: "2024-01-02T00:00:00.000Z" },
    ]);
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
      where: { sessionId: "session-1" },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, createdAt: true },
    });
  });

  it("should return session list when no sessionId is provided", async () => {
    const mockDate = "2024-01-01T00:00:00.000Z";
    const mockDate2 = "2024-01-02T00:00:00.000Z";
    const sessions = [
      { id: "session-1", title: "Chat 1", createdAt: new Date(mockDate), updatedAt: new Date(mockDate) },
      { id: "session-2", title: null, createdAt: new Date(mockDate2), updatedAt: new Date(mockDate2) },
    ];

    vi.mocked(prisma.chatSession.findMany).mockResolvedValue(sessions as never);

    const req = makeGetRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // Dates get serialized to strings in JSON
    expect(data.sessions).toEqual([
      { id: "session-1", title: "Chat 1", createdAt: mockDate, updatedAt: mockDate },
      { id: "session-2", title: null, createdAt: mockDate2, updatedAt: mockDate2 },
    ]);
    expect(prisma.chatSession.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  });

  it("should return 500 on database error when fetching messages", async () => {
    vi.mocked(prisma.chatMessage.findMany).mockRejectedValue(new Error("DB error"));

    const req = makeGetRequest("session-1");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toMatch(/database error/i);
  });

  it("should return 500 on database error when fetching sessions", async () => {
    vi.mocked(prisma.chatSession.findMany).mockRejectedValue(new Error("DB error"));

    const req = makeGetRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toMatch(/database error/i);
  });
});
