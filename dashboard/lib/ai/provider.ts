/**
 * Groq AI provider for LLM calls with PII redaction support.
 *
 * This module provides a type-safe interface for calling Groq's API
 * with redacted text. The RedactedText branded type ensures that
 * only properly redacted content can be sent to the AI model.
 *
 * Usage example:
 * ```ts
 * import { callAI } from "@/lib/ai/provider";
 * import { redact, unredact, loadEntities } from "@/lib/redaction";
 *
 * const entities = await loadEntities();
 * const { redactedText, tokenMap } = redact(userInput, entities);
 *
 * const aiResponse = await callAI(redactedText, {
 *   systemPrompt: "You are a helpful assistant",
 *   temperature: 0.7,
 *   jsonMode: false,
 * });
 *
 * const { originalText } = unredact(aiResponse, tokenMap);
 * ```
 */

import type { RedactedText } from "@/lib/redaction";

/**
 * Default Groq model for LLM calls.
 * Can be overridden via GROQ_MODEL environment variable.
 */
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Default timeout for API calls in milliseconds (30 seconds).
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Default temperature for model responses.
 */
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Groq API endpoint (OpenAI-compatible).
 */
const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Options for AI provider calls.
 */
export interface CallAIOptions {
  /** System prompt to set context for the model */
  systemPrompt?: string;
  /** Temperature for response randomness (0.0 - 2.0) */
  temperature?: number;
  /** Enable JSON mode for structured responses */
  jsonMode?: boolean;
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  maxCompletionTokens?: number;
}

/**
 * Error thrown when the AI provider fails.
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

function getSafeGroqErrorDetails(errorBody: string): Record<string, string> {
  const fallback = {
    message: "Provider returned an unstructured error response.",
  };

  try {
    const parsed: unknown = JSON.parse(errorBody);
    const providerError =
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      parsed.error &&
      typeof parsed.error === "object"
        ? parsed.error
        : parsed;

    if (!providerError || typeof providerError !== "object") {
      return fallback;
    }

    const providerRecord = providerError as Record<string, unknown>;
    const details: Record<string, string> = {};

    // Extract standard error fields
    for (const key of ["message", "code", "type"]) {
      const value = providerRecord[key];
      if (typeof value === "string" || typeof value === "number") {
        details[key] = String(value).slice(0, 500);
      }
    }

    // Extract failed_generation if present (for json_validate_failed errors)
    if ("failed_generation" in providerRecord) {
      const failedGen = providerRecord.failed_generation;
      if (typeof failedGen === "string") {
        details.failed_generation = failedGen.slice(0, 1000); // Show more for debugging
      }
    }

    return Object.keys(details).length > 0 ? details : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Calls the Groq AI API with redacted text.
 *
 * @param redactedPrompt - The user message (must be RedactedText branded type)
 * @param options - Optional configuration for the API call
 * @returns Raw model response text (caller must unredact)
 * @throws {AIProviderError} If the API call fails or times out
 * @throws {Error} If GROQ_API_KEY is not set
 *
 * @example
 * ```ts
 * const response = await callAI(redactedText, {
 *   systemPrompt: "You are a medical assistant",
 *   temperature: 0.5,
 *   jsonMode: true,
 * });
 * ```
 */
export async function callAI(
  redactedPrompt: RedactedText,
  options?: CallAIOptions
): Promise<string> {
  // Validate API key at call time (not import time)
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY environment variable is not set. Please configure it in your .env file."
    );
  }

  const {
    systemPrompt,
    temperature = DEFAULT_TEMPERATURE,
    jsonMode = false,
    jsonSchema,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxCompletionTokens = 1500,
  } = options ?? {};

  const model = process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;

  // Build messages array
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: redactedPrompt });

  // Build request body
  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_completion_tokens: 1500,
  };

  if (jsonSchema) {
  requestBody.response_format = {
    type: "json_schema",
    json_schema: {
      name: jsonSchema.name,
      strict: jsonSchema.strict ?? true,
      schema: jsonSchema.schema,
    },
  };
} else if (jsonMode) {
  requestBody.response_format = {
    type: "json_object",
  };
}

  // Create abort controller for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const serializedBody = JSON.stringify(requestBody);

    console.log("[Groq] Request size:", {
      characters: serializedBody.length,
      kb: Math.round(serializedBody.length / 1024),
      model,
      promptCharacters: redactedPrompt.length,
      systemCharacters: systemPrompt?.length ?? 0,
    });

    const response = await fetch(GROQ_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-OK responses
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Groq] Request rejected:", {
        status: response.status,
        statusText: response.statusText,
        ...getSafeGroqErrorDetails(errorBody),
      });
      throw new AIProviderError(
        `Groq API request failed: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    // Parse response
    const data = await response.json();

    // Extract content from response
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new AIProviderError(
        "Invalid response format: missing content in response",
        response.status,
        JSON.stringify(data)
      );
    }

    return content;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort/timeout
    if (error instanceof Error && error.name === "AbortError") {
      throw new AIProviderError(
        `Groq API request timed out after ${timeoutMs}ms`
      );
    }

    // Re-throw AIProviderError as-is
    if (error instanceof AIProviderError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof Error) {
      throw new AIProviderError(`Groq API request failed: ${error.message}`);
    }

    // Unknown error
    throw new AIProviderError("Groq API request failed with unknown error");
  }
}
