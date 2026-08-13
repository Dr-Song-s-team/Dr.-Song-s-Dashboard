/**
 * Layer 1: Chat flow integration tests.
 * Tests full request flow with mocked callAI and shaped Prisma mocks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import { callAI } from "@/lib/ai/provider";
import { loadEntities } from "@/lib/redaction";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
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

// Mock retrieval functions with real-shaped data
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

describe("Chat Flow Integration Tests", () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.GROQ_API_KEY = "test-api-key";

    // Default mocks
    vi.mocked(loadEntities).mockResolvedValue([]);
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([]);

    // Default redaction behavior
    const redactionModule = await import("@/lib/redaction");
    vi.mocked(redactionModule.redact).mockImplementation((text) => ({
      redactedText: text as never,
      tokenMap: new Map(),
    }));
    vi.mocked(redactionModule.unredact).mockImplementation((text) => ({
      originalText: text,
      unknownTokens: [],
    }));

    // Default retrieval mocks
    const retrievalModule = await import("@/lib/chat/retrieval");
    vi.mocked(retrievalModule.searchEmails).mockResolvedValue([]);
    vi.mocked(retrievalModule.searchPatients).mockResolvedValue([]);
    vi.mocked(retrievalModule.searchDocuments).mockResolvedValue([]);
    vi.mocked(retrievalModule.buildContext).mockReturnValue("");
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("Alice Vance status flow: non-empty context passed to answer call", async () => {
    const retrievalModule = await import("@/lib/chat/retrieval");

    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    // Mock emails that mention Alice Vance
    const mockEmails = [
      {
        id: "email-1",
        subject: "Mandatory Prior Authorization Deadline for Patient Alice Vance",
        fromName: "Claims",
        fromEmail: "claims@insurance.com",
        body: "Authorization needed by July 24th",
        aiSummary: "Prior auth required for Alice Vance",
        receivedAt: new Date("2024-07-13"),
      },
    ];

    vi.mocked(retrievalModule.searchEmails).mockResolvedValue(mockEmails as never);

    // buildContext returns non-empty text
    const mockContext = "=== EMAILS ===\n- [2024-07-13] From: Claims | Subject: Prior Auth for Alice Vance";
    vi.mocked(retrievalModule.buildContext).mockReturnValue(mockContext);

    // Intent returns scope: "all"
    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: ["Alice", "Vance"], scope: "all" }))
      .mockResolvedValueOnce("Alice Vance has a prior authorization deadline on July 24th.");

    const req = makePostRequest({ message: "What's the status of Alice Vance" });
    const res = await POST(req);
    await res.json();

    expect(res.status).toBe(200);

    // Verify context was built
    expect(retrievalModule.buildContext).toHaveBeenCalledWith(
      mockEmails,
      [],
      []
    );

    // Verify answer call received a prompt containing context
    expect(callAI).toHaveBeenCalledTimes(2);
    const answerCall = vi.mocked(callAI).mock.calls[1];
    const answerPrompt = answerCall[0];
    const answerOptions = answerCall[1];

    // The prompt should contain the context markers
    expect(answerPrompt).toContain("CLINIC DATA CONTEXT");
    expect(answerPrompt).toContain("Alice Vance");

    // System prompt should contain instructions about using provided information
    expect(answerOptions?.systemPrompt).toContain("clinic admin assistant");

    // Answer persisted
    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining("Alice Vance"),
        }),
      })
    );
  });

  it("Scope regression: person name triggers 'ALWAYS use scope all' instruction", async () => {
    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: ["John", "Doe"], scope: "all" }))
      .mockResolvedValueOnce("No information found");

    const req = makePostRequest({ message: "Find John Doe" });
    await POST(req);

    // Check intent call
    expect(callAI).toHaveBeenCalledTimes(2);
    const intentCall = vi.mocked(callAI).mock.calls[0];
    const intentOptions = intentCall[1];

    // System prompt must include the scope instruction
    expect(intentOptions?.systemPrompt).toContain("ALWAYS use scope");
    expect(intentOptions?.systemPrompt).toContain("all");
    expect(intentOptions?.systemPrompt).toContain("names appear in both patients AND emails");
  });

  it("Empty retrieval + scope none: answer call happens, context section absent", async () => {
    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    const retrievalModule = await import("@/lib/chat/retrieval");
    vi.mocked(retrievalModule.buildContext).mockReturnValue(""); // Empty context

    // Intent returns scope: "none"
    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: [], scope: "none" }))
      .mockResolvedValueOnce("HIPAA is a healthcare privacy law.");

    const req = makePostRequest({ message: "What is HIPAA?" });
    const res = await POST(req);

    expect(res.status).toBe(200);

    // Retrieval should not be called
    expect(retrievalModule.searchEmails).not.toHaveBeenCalled();
    expect(retrievalModule.searchPatients).not.toHaveBeenCalled();
    expect(retrievalModule.searchDocuments).not.toHaveBeenCalled();

    // Answer call still happens
    expect(callAI).toHaveBeenCalledTimes(2);

    // Answer call should still have the system prompt
    const answerOptions = vi.mocked(callAI).mock.calls[1][1];
    expect(answerOptions?.systemPrompt).toContain("clinic admin assistant");
  });

  it("Redaction boundary: answer call receives REDACTED text only", async () => {
    const redactionModule = await import("@/lib/redaction");
    const retrievalModule = await import("@/lib/chat/retrieval");

    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    // Mock loadEntities to return Alice Vance as an entity
    vi.mocked(loadEntities).mockResolvedValue([
      { type: "PERSON_NAME", value: "Alice Vance" },
    ] as never);

    // Mock redact to actually redact "Alice Vance"
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
      };
    });

    // Mock buildContext to return text WITH the raw name
    const contextWithRawName = "=== EMAILS ===\n- Subject: Alice Vance authorization needed";
    vi.mocked(retrievalModule.buildContext).mockReturnValue(contextWithRawName);

    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: ["{{PERSON_1}}"], scope: "all" }))
      .mockResolvedValueOnce("{{PERSON_1}} needs authorization.");

    const req = makePostRequest({ message: "What about Alice Vance?" });
    await POST(req);

    // Check answer call
    const answerCall = vi.mocked(callAI).mock.calls[1];
    const answerPrompt = answerCall[0] as string;

    // The prompt sent to callAI should NOT contain the raw name "Alice Vance"
    // It should contain the redacted token instead
    expect(answerPrompt).toContain("{{PERSON_1}}");
    expect(answerPrompt).not.toContain("Alice Vance");
  });

  it("429 from answer call: returns 429 JSON, user message persisted, no assistant message", async () => {
    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    // Intent succeeds, answer call returns 429
    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: [], scope: "none" }))
      .mockRejectedValueOnce(new AIProviderError("Rate limit", 429));

    const req = makePostRequest({ message: "Test question" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBe("rate_limited");

    // User message should be persisted (once)
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(1);
    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "user",
          content: "Test question",
        }),
      })
    );

    // No assistant message should be persisted
    const calls = vi.mocked(prisma.chatMessage.create).mock.calls;
    const assistantCalls = calls.filter(
      (call) => call[0].data.role === "assistant"
    );
    expect(assistantCalls).toHaveLength(0);
  });

  it("Conversation history included in intent call", async () => {
    vi.mocked(prisma.chatSession.findUnique).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    // Mock history
    const mockHistory = [
      { role: "user", content: "Who is Alice Vance?" },
      { role: "assistant", content: "Alice Vance is mentioned in emails." },
      { role: "user", content: "What insurer does she have?" },
    ];

    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue(mockHistory as never);

    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: ["Alice", "Vance", "insurer"], scope: "all" }))
      .mockResolvedValueOnce("Based on emails, her insurer is Blue Cross.");

    const req = makePostRequest({
      sessionId: "session-1",
      message: "What insurer does she have?",
    });

    await POST(req);

    // Check intent call includes history
    const intentCall = vi.mocked(callAI).mock.calls[0];
    const intentPrompt = intentCall[0] as string;

    // Should contain previous messages
    expect(intentPrompt).toContain("Alice Vance");
    expect(intentPrompt).toContain("insurer does she have");
  });

  it("Search terms unredacted before Prisma queries", async () => {
    const redactionModule = await import("@/lib/redaction");
    const retrievalModule = await import("@/lib/chat/retrieval");

    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);

    // Mock redaction
    vi.mocked(redactionModule.redact).mockImplementation((text) => {
      const tokenMap = new Map<string, string>();
      let redactedText = text;

      if (text.includes("Maria Santos")) {
        tokenMap.set("{{PERSON_1}}", "Maria Santos");
        redactedText = text.replace(/Maria Santos/g, "{{PERSON_1}}");
      }

      return {
        redactedText: redactedText as never,
        tokenMap,
      };
    });

    vi.mocked(redactionModule.unredact).mockImplementation((text, tokenMap) => ({
      originalText: text.replace(/\{\{PERSON_1\}\}/g, tokenMap.get("{{PERSON_1}}") || "{{PERSON_1}}"),
      unknownTokens: [],
    }));

    // AI returns redacted token
    vi.mocked(callAI)
      .mockResolvedValueOnce(JSON.stringify({ searchTerms: ["{{PERSON_1}}"], scope: "patients" }))
      .mockResolvedValueOnce("Patient information");

    vi.mocked(retrievalModule.searchPatients).mockResolvedValue([]);

    const req = makePostRequest({ message: "Find Maria Santos" });
    await POST(req);

    // searchPatients should receive UNREDACTED name
    expect(retrievalModule.searchPatients).toHaveBeenCalled();
    const searchArgs = vi.mocked(retrievalModule.searchPatients).mock.calls[0][0];

    // Should include the real name
    expect(searchArgs).toContain("Maria Santos");
    // Should NOT include the token
    expect(searchArgs.some((term: string) => term.includes("{{PERSON"))).toBe(false);
  });
});
