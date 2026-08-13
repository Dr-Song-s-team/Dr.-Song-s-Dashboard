/**
 * Core redaction service.
 *
 * Main functions:
 * - redact(): Replace PII with tokens (pure, synchronous)
 * - unredact(): Restore original PII from tokens (handles AI responses)
 * - loadEntities(): Load entity data from database (caller responsibility)
 */

import type {
  RedactedText,
  EntityData,
  RedactionResult,
  UnredactionResult,
} from "./types";
import { runAllDetectors } from "./detectors";
import { resolveOverlaps } from "./overlap";

/**
 * Redact PII from text using pattern-based and entity-based detection.
 *
 * This function is pure and synchronous - it does not access the database.
 * Callers must load entities using loadEntities() and pass them in.
 *
 * @param text - The text to redact
 * @param entities - Entity data loaded from the database
 * @returns RedactionResult containing redacted text, token map, and matches
 */
export function redact(text: string, entities: EntityData): RedactionResult {
  // Create cache for this redaction session
  const cache = new Map<string, string>();

  // Run all detectors
  const allMatches = runAllDetectors(text, entities, cache);

  // Resolve overlaps
  const resolvedMatches = resolveOverlaps(allMatches);

  // Sort matches by start position (descending) so we can replace from end to start
  // This prevents index shifts during replacement
  const sortedMatches = [...resolvedMatches].sort((a, b) => b.start - a.start);

  // Build token map and perform replacements
  const tokenMap = new Map<string, string>();
  let redactedText = text;

  for (const match of sortedMatches) {
    // Record the token -> original text mapping
    tokenMap.set(match.token, match.originalText);

    // Replace the text with the token
    redactedText =
      redactedText.slice(0, match.start) +
      match.token +
      redactedText.slice(match.end);
  }

  return {
    redactedText: redactedText as RedactedText,
    tokenMap,
    matches: resolvedMatches,
  };
}

/**
 * Unredact text by replacing tokens with their original values.
 *
 * This function is designed to handle AI responses, which may contain:
 * - Known tokens from our token map (replace them)
 * - Unknown/hallucinated tokens (leave as-is, log warning)
 * - Plain text with no tokens (return as-is)
 *
 * @param redactedText - The text containing tokens to replace
 * @param tokenMap - Map of tokens to their original values
 * @returns UnredactionResult with original text and list of unknown tokens
 */
export function unredact(
  redactedText: string,
  tokenMap: Map<string, string>
): UnredactionResult {
  let originalText = redactedText;
  const unknownTokens: string[] = [];

  // Find all tokens in the text (format: {{TYPE_N}})
  const tokenRegex = /\{\{[A-Z_]+_\d+\}\}/g;
  const foundTokens = redactedText.match(tokenRegex) || [];

  // Replace each token
  for (const token of foundTokens) {
    const originalValue = tokenMap.get(token);

    if (originalValue !== undefined) {
      // Known token - replace it
      originalText = originalText.replace(token, originalValue);
    } else {
      // Unknown token - leave it as-is and record it
      unknownTokens.push(token);
      console.warn(
        `[unredact] Unknown token encountered: ${token}. This may be an AI hallucination.`
      );
    }
  }

  return {
    originalText,
    unknownTokens,
  };
}
