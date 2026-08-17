/**
 * Tests for Groq AI provider.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { callAI, DEFAULT_GROQ_MODEL, AIProviderError } from "../provider";
import type { RedactedText } from "@/lib/redaction";

// Helper to create RedactedText for testing
function asRedactedText(text: string): RedactedText {
  return text as RedactedText;
}

describe("AI Provider (Groq)", () => {
  const originalEnv = process.env;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset env vars
    process.env = { ...originalEnv };
    process.env.GROQ_API_KEY = "test-api-key";

    // Mock global fetch
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    // Restore env vars
    process.env = originalEnv;

    // Clear mocks
    vi.unstubAllGlobals();
  });

  it("should successfully return content from API", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: "This is the AI response",
          },
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const redactedPrompt = asRedactedText("What is {{PATIENT_NAME_1}}'s condition?");
    const result = await callAI(redactedPrompt);

    expect(result).toBe("This is the AI response");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Verify request structure
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer test-api-key",
    });

    const body = JSON.parse(options.body);
    expect(body.model).toBe(DEFAULT_GROQ_MODEL);
    expect(body.messages).toEqual([
      { role: "user", content: "What is {{PATIENT_NAME_1}}'s condition?" },
    ]);
    expect(body.temperature).toBe(0.7);
  });

  it("should throw error when GROQ_API_KEY is missing", async () => {
    delete process.env.GROQ_API_KEY;

    const redactedPrompt = asRedactedText("Test prompt");

    await expect(callAI(redactedPrompt)).rejects.toThrow(
      "GROQ_API_KEY environment variable is not set"
    );

    // Fetch should not be called
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should throw AIProviderError with status on HTTP error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => JSON.stringify({ error: "Rate limit exceeded" }),
    });

    const redactedPrompt = asRedactedText("Test prompt");

    try {
      await callAI(redactedPrompt);
      expect.fail("Should have thrown AIProviderError");
    } catch (error) {
      expect(error).toBeInstanceOf(AIProviderError);
      if (error instanceof AIProviderError) {
        expect(error.statusCode).toBe(429);
        expect(error.responseBody).toContain("Rate limit exceeded");
        expect(error.message).toContain("429");
        expect(error.message).toContain("Too Many Requests");
      }
    }
  });

  it("should throw AIProviderError on timeout", async () => {
    // Mock a fetch that respects the abort signal
    fetchMock.mockImplementationOnce(
      (_url: string | URL | Request, options: RequestInit) =>
        new Promise((_, reject) => {
          // Listen for abort signal
          if (options.signal) {
            options.signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted", "AbortError"));
            });
          }
        })
    );

    const redactedPrompt = asRedactedText("Test prompt");

    try {
      await callAI(redactedPrompt, { timeoutMs: 100 });
      expect.fail("Should have thrown AIProviderError on timeout");
    } catch (error) {
      expect(error).toBeInstanceOf(AIProviderError);
      if (error instanceof AIProviderError) {
        expect(error.message).toContain("timed out");
        expect(error.message).toContain("100ms");
      }
    }
  });

  it("should set response_format when jsonMode is true", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: '{"result": "json response"}',
          },
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const redactedPrompt = asRedactedText("Generate JSON");
    await callAI(redactedPrompt, { jsonMode: true });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("should use GROQ_MODEL env var to override model", async () => {
    process.env.GROQ_MODEL = "llama-3.1-8b-instant";

    const mockResponse = {
      choices: [
        {
          message: {
            content: "Response from custom model",
          },
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const redactedPrompt = asRedactedText("Test prompt");
    await callAI(redactedPrompt);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.model).toBe("llama-3.1-8b-instant");
  });

  it("should fall back to DEFAULT_GROQ_MODEL when GROQ_MODEL is empty string", async () => {
    process.env.GROQ_MODEL = "";

    const mockResponse = {
      choices: [
        {
          message: {
            content: "Response",
          },
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const redactedPrompt = asRedactedText("Test prompt");
    await callAI(redactedPrompt);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.model).toBe(DEFAULT_GROQ_MODEL);
  });

  it("should fall back to DEFAULT_GROQ_MODEL when GROQ_MODEL is whitespace", async () => {
    process.env.GROQ_MODEL = "   ";

    const mockResponse = {
      choices: [
        {
          message: {
            content: "Response",
          },
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const redactedPrompt = asRedactedText("Test prompt");
    await callAI(redactedPrompt);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.model).toBe(DEFAULT_GROQ_MODEL);
  });

  it("should throw AIProviderError when response has no content", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            // Missing content field
          },
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const redactedPrompt = asRedactedText("Test prompt");

    try {
      await callAI(redactedPrompt);
      expect.fail("Should have thrown AIProviderError for missing content");
    } catch (error) {
      expect(error).toBeInstanceOf(AIProviderError);
      if (error instanceof AIProviderError) {
        expect(error.message).toContain("Invalid response format");
        expect(error.message).toContain("missing content");
      }
    }
  });

  it("should include systemPrompt in messages when provided", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: "Response with system prompt",
          },
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const redactedPrompt = asRedactedText("User message");
    await callAI(redactedPrompt, {
      systemPrompt: "You are a medical assistant",
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.messages).toEqual([
      { role: "system", content: "You are a medical assistant" },
      { role: "user", content: "User message" },
    ]);
  });

  it("should use custom temperature when provided", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: "Response",
          },
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const redactedPrompt = asRedactedText("Test");
    await callAI(redactedPrompt, { temperature: 0.2 });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.temperature).toBe(0.2);
  });

  // Type-level test: plain string should cause compile error
  it("should not accept plain string (type-level test)", async () => {
    const mockResponse = {
      choices: [{ message: { content: "Response" } }],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    // This should cause a TypeScript error
    // @ts-expect-error - plain string should not be accepted
    await callAI("This is a plain string, not RedactedText");

    // Test passes if TypeScript compilation catches the error
  });
});
