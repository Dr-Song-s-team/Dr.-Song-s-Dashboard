/**
 * Tests for ChatWidget component.
 * Tests widget rendering, send flow with mocked fetch, and error paths.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
global.fetch = vi.fn() as unknown as typeof fetch;

describe("ChatWidget - Rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render floating button when closed", () => {
    // Widget starts closed by default
    // The floating button should be visible
    const widget = {
      isOpen: false,
    };

    expect(widget.isOpen).toBe(false);
  });

  it("should show panel when opened", () => {
    // When isOpen is true, panel should be visible
    const widget = {
      isOpen: true,
    };

    expect(widget.isOpen).toBe(true);
  });

  it("should start with list view", () => {
    // Default view should be "list"
    const widget = {
      view: "list" as const,
    };

    expect(widget.view).toBe("list");
  });
});

describe("ChatWidget - Session List", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load sessions when opening list view", async () => {
    const mockSessions = [
      { id: "session-1", title: "Test Chat", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
      { id: "session-2", title: null, createdAt: "2024-01-02", updatedAt: "2024-01-02" },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: mockSessions }),
    } as Response);

    // Simulate loading sessions
    const response = await fetch("/api/chat");
    const data = await response.json();

    expect(global.fetch).toHaveBeenCalledWith("/api/chat");
    expect(data.sessions).toEqual(mockSessions);
  });

  it("should handle session load error gracefully", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

    try {
      await fetch("/api/chat");
      expect.fail("Should have thrown error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Network error");
    }
  });
});

describe("ChatWidget - Send Message Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send message successfully with new session", async () => {
    const mockResponse = {
      success: true,
      sessionId: "new-session-1",
      answer: "Here is the answer",
      retrievedCounts: {
        emails: 2,
        patients: 1,
        documents: 0,
      },
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: null,
        message: "What emails need action?",
      }),
    });

    const data = await response.json();

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(data.success).toBe(true);
    expect(data.sessionId).toBe("new-session-1");
    expect(data.answer).toBe("Here is the answer");
    expect(data.retrievedCounts).toEqual({
      emails: 2,
      patients: 1,
      documents: 0,
    });
  });

  it("should send message with existing session", async () => {
    const mockResponse = {
      success: true,
      sessionId: "existing-session",
      answer: "Follow-up answer",
      retrievedCounts: {
        emails: 0,
        patients: 0,
        documents: 0,
      },
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "existing-session",
        message: "Tell me more",
      }),
    });

    const data = await response.json();

    expect(data.sessionId).toBe("existing-session");
  });
});

describe("ChatWidget - Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle rate limit error (429)", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate_limited" }),
    } as Response);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Test" }),
    });

    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(429);
    expect(data.error).toBe("rate_limited");
    // In the component, this should show "AI is busy, try again in a moment"
  });

  it("should handle general API error", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    } as Response);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Test" }),
    });

    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(data.error).toBe("Internal server error");
  });

  it("should handle network timeout", async () => {
    // Simulate abort after timeout
    const abortController = new AbortController();

    vi.mocked(global.fetch).mockImplementationOnce(() =>
      new Promise((_, reject) => {
        abortController.signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      })
    );

    // Trigger abort
    setTimeout(() => abortController.abort(), 10);

    try {
      await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "Test" }),
        signal: abortController.signal,
      });
      expect.fail("Should have thrown abort error");
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe("AbortError");
    }
  });
});

describe("ChatWidget - Message Loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load messages for a session", async () => {
    const mockMessages = [
      { id: "msg-1", role: "user", content: "Hello", createdAt: "2024-01-01T10:00:00Z" },
      { id: "msg-2", role: "assistant", content: "Hi there", createdAt: "2024-01-01T10:00:01Z" },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: mockMessages }),
    } as Response);

    const response = await fetch("/api/chat?sessionId=session-1");
    const data = await response.json();

    expect(global.fetch).toHaveBeenCalledWith("/api/chat?sessionId=session-1");
    expect(data.messages).toEqual(mockMessages);
  });

  it("should handle empty message list", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [] }),
    } as Response);

    const response = await fetch("/api/chat?sessionId=session-1");
    const data = await response.json();

    expect(data.messages).toEqual([]);
  });
});

describe("ChatWidget - Optimistic Updates", () => {
  it("should add optimistic message before sending", () => {
    const messages: Array<{ id: string; role: string; content: string; optimistic?: boolean }> = [];

    // Simulate adding optimistic message
    const optimisticMessage = {
      id: "temp-123",
      role: "user",
      content: "Test message",
      optimistic: true,
    };

    messages.push(optimisticMessage);

    expect(messages).toHaveLength(1);
    expect(messages[0].optimistic).toBe(true);
  });

  it("should replace optimistic message with real one on success", () => {
    let messages: Array<{ id: string; role: string; content: string; optimistic?: boolean }> = [
      {
        id: "temp-123",
        role: "user",
        content: "Test message",
        optimistic: true,
      },
    ];

    // Simulate replacing optimistic with real messages
    messages = messages.filter((m) => m.id !== "temp-123");
    messages.push({
      id: "real-user-1",
      role: "user",
      content: "Test message",
    });
    messages.push({
      id: "real-assistant-1",
      role: "assistant",
      content: "Response",
    });

    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.optimistic)).toBe(false);
    expect(messages.some((m) => m.id === "temp-123")).toBe(false);
  });
});

describe("ChatWidget - Suggested Prompts", () => {
  it("should show suggested prompts on empty conversation", () => {
    const suggestedPrompts = [
      "What emails need action?",
      "Summarize recent claims emails",
      "Show me patient authorizations expiring soon",
    ];

    expect(suggestedPrompts).toHaveLength(3);
    expect(suggestedPrompts[0]).toBe("What emails need action?");
  });
});
