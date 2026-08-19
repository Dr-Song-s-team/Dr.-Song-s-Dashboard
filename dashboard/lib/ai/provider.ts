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
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/**
 * Default OpenRouter model for fallback.
 * Can be overridden via OPENROUTER_MODEL environment variable.
 */
export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-oss-120b";

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
 * OpenRouter API endpoint (OpenAI-compatible).
 */
const OPENROUTER_API_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

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
 * Helper function to call an OpenAI-compatible API endpoint.
 *
 * @param endpoint - API endpoint URL
 * @param apiKey - API key for authentication
 * @param model - Model name to use
 * @param redactedPrompt - The user message (RedactedText)
 * @param options - Call options
 * @param providerName - Provider name for logging (e.g., "Groq", "OpenRouter")
 * @returns Raw model response text
 * @throws {AIProviderError} If the API call fails
 */
async function callOpenAICompatibleAPI(
  endpoint: string,
  apiKey: string,
  model: string,
  redactedPrompt: RedactedText,
  options: CallAIOptions,
  providerName: string
): Promise<string> {
  const {
    systemPrompt,
    temperature = DEFAULT_TEMPERATURE,
    jsonMode = false,
    jsonSchema,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

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

    console.log(`[${providerName}] Request size:`, {
      characters: serializedBody.length,
      kb: Math.round(serializedBody.length / 1024),
      model,
      promptCharacters: redactedPrompt.length,
      systemCharacters: systemPrompt?.length ?? 0,
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: serializedBody,
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    // Log rate limit headers (for tier verification)
    const rateLimitHeaders = {
      limit: response.headers.get("x-ratelimit-limit-tokens"),
      remaining: response.headers.get("x-ratelimit-remaining-tokens"),
      reset: response.headers.get("x-ratelimit-reset-tokens"),
    };
    if (rateLimitHeaders.limit) {
      console.log(`[${providerName}] Rate limit headers:`, rateLimitHeaders);
    }

    // Handle non-OK responses
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[${providerName}] Request rejected:`, {
        status: response.status,
        statusText: response.statusText,
        ...getSafeGroqErrorDetails(errorBody),
      });
      throw new AIProviderError(
        `${providerName} API request failed: ${response.status} ${response.statusText}`,
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

    console.log(`[${providerName}] Request succeeded`);
    return content;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort/timeout
    if (error instanceof Error && error.name === "AbortError") {
      throw new AIProviderError(
        `${providerName} API request timed out after ${timeoutMs}ms`
      );
    }

    // Re-throw AIProviderError as-is
    if (error instanceof AIProviderError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof Error) {
      throw new AIProviderError(`${providerName} API request failed: ${error.message}`);
    }

    // Unknown error
    throw new AIProviderError(`${providerName} API request failed with unknown error`);
  }
}

/**
 * Checks if an error is a rate limit (429) or server error (5xx).
 */
function shouldFallbackToOpenRouter(error: unknown): boolean {
  if (!(error instanceof AIProviderError)) {
    return false;
  }

  const statusCode = error.statusCode;
  if (!statusCode) {
    return false;
  }

  // 429 = rate limit, 5xx = server errors
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

/**
 * Calls the Groq AI API with redacted text, with automatic OpenRouter fallback.
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
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error(
      "GROQ_API_KEY environment variable is not set. Please configure it in your .env file."
    );
  }

  const groqModel = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  const opts = options ?? {};

  // Try Groq first
  try {
    return await callOpenAICompatibleAPI(
      GROQ_API_ENDPOINT,
      groqApiKey,
      groqModel,
      redactedPrompt,
      opts,
      "Groq"
    );
  } catch (groqError) {
    // Check if we should fallback to OpenRouter
    if (!shouldFallbackToOpenRouter(groqError)) {
      // Non-retriable error or not a 429/5xx - propagate immediately
      throw groqError;
    }

    // Check if OpenRouter fallback is configured
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      console.log("[OpenRouter] Fallback skipped: OPENROUTER_API_KEY not set");
      throw groqError;
    }

    // Fallback to OpenRouter
    const openRouterModel = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
    console.log(`[OpenRouter] Falling back after Groq ${groqError instanceof AIProviderError ? groqError.statusCode : "error"}`);

    try {
      return await callOpenAICompatibleAPI(
        OPENROUTER_API_ENDPOINT,
        openRouterApiKey,
        openRouterModel,
        redactedPrompt,
        opts,
        "OpenRouter"
      );
    } catch (openRouterError) {
      // OpenRouter also failed - throw the OpenRouter error
      console.error("[OpenRouter] Fallback failed");
      throw openRouterError;
    }
  }
}
