/**
 * Miss detection - scan text for potential PII that wasn't redacted.
 *
 * This module scans text (plain or AI responses) for patterns that might
 * indicate PII that slipped through redaction.
 *
 * Severity levels:
 * - High: SSN, email, exact entity names → throw error
 * - Low: Generic capitalized word pairs → warn + log only
 */

import type { MissDetection, RedactionConfig } from "./types";

/**
 * Default configuration for miss detection.
 */
const DEFAULT_CONFIG: Required<RedactionConfig> = {
  throwOnHighSeverityMiss: true,
  logLowSeverityMisses: true,
};

/**
 * Scan text for potential PII misses.
 *
 * High-severity patterns (will throw if config.throwOnHighSeverityMiss is true):
 * - SSN patterns (XXX-XX-XXXX)
 * - Email patterns
 * - Phone patterns
 *
 * Low-severity patterns (will only warn/log):
 * - Capitalized word pairs (might be names, but also "Blue Cross", "Explanation of Benefits")
 *
 * @param text - The text to scan (can be plain text or AI response)
 * @param config - Configuration for miss detection behavior
 * @returns Array of detected potential misses
 * @throws Error if high-severity miss detected and config.throwOnHighSeverityMiss is true
 */
export function scanText(
  text: string,
  config: RedactionConfig = {}
): MissDetection[] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const misses: MissDetection[] = [];

  // High-severity: SSN patterns
  const ssnRegex = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;
  let match: RegExpExecArray | null;
  while ((match = ssnRegex.exec(text)) !== null) {
    misses.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      type: "ssn",
      severity: "high",
      reason: "SSN pattern detected in text that should have been redacted",
    });
  }

  // High-severity: Email patterns
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  while ((match = emailRegex.exec(text)) !== null) {
    misses.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      type: "email",
      severity: "high",
      reason: "Email address detected in text that should have been redacted",
    });
  }

  // High-severity: Phone patterns
  const phoneRegex =
    /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    misses.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      type: "phone",
      severity: "high",
      reason:
        "Phone number detected in text that should have been redacted",
    });
  }

  // Low-severity: Capitalized word pairs (might be names, but lots of false positives)
  // This pattern catches "John Smith" but also "Blue Cross", "Explanation of Benefits"
  const capitalizedPairRegex = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
  while ((match = capitalizedPairRegex.exec(text)) !== null) {
    // Skip if it's already part of a high-severity miss
    const overlapsWithHighSeverity = misses.some(
      (m) =>
        m.severity === "high" &&
        match!.index >= m.start &&
        match!.index < m.end
    );

    if (!overlapsWithHighSeverity) {
      misses.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        type: "generic_entity",
        severity: "low",
        reason:
          "Capitalized word pair detected - might be a name or common phrase",
      });
    }
  }

  // Handle high-severity misses
  const highSeverityMisses = misses.filter((m) => m.severity === "high");
  if (highSeverityMisses.length > 0 && finalConfig.throwOnHighSeverityMiss) {
    const missDescriptions = highSeverityMisses
      .map((m) => `${m.type} at position ${m.start}: "${m.text}"`)
      .join(", ");
    throw new Error(
      `High-severity PII detected in text that should have been redacted: ${missDescriptions}`
    );
  }

  // Log low-severity misses if configured
  const lowSeverityMisses = misses.filter((m) => m.severity === "low");
  if (lowSeverityMisses.length > 0 && finalConfig.logLowSeverityMisses) {
    console.warn(
      `[scanText] ${lowSeverityMisses.length} low-severity potential PII patterns detected:`
    );
    for (const miss of lowSeverityMisses) {
      console.warn(
        `  - ${miss.type} at position ${miss.start}: "${miss.text}" (${miss.reason})`
      );
    }
  }

  return misses;
}
