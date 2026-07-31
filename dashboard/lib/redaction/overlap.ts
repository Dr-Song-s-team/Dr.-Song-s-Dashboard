/**
 * Overlap resolution for detector matches.
 *
 * When multiple detectors match overlapping text, we need to resolve conflicts
 * by keeping the best match according to these rules:
 * 1. Keep the longest span
 * 2. If spans are equal length, keep the highest confidence match
 */

import type { DetectorMatch, ConfidenceLevel } from "./types";

/**
 * Get numeric value for confidence level (higher is better).
 */
function confidenceValue(confidence: ConfidenceLevel): number {
  switch (confidence) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

/**
 * Check if two matches overlap.
 */
function matchesOverlap(a: DetectorMatch, b: DetectorMatch): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Compare two overlapping matches and return the better one.
 * Priority: longest span > highest confidence
 */
function chooseBetterMatch(
  a: DetectorMatch,
  b: DetectorMatch
): DetectorMatch {
  const aLength = a.end - a.start;
  const bLength = b.end - b.start;

  // Prefer longer span
  if (aLength !== bLength) {
    return aLength > bLength ? a : b;
  }

  // If same length, prefer higher confidence
  const aConfidence = confidenceValue(a.confidence);
  const bConfidence = confidenceValue(b.confidence);

  return aConfidence >= bConfidence ? a : b;
}

/**
 * Resolve overlapping matches by keeping the best match for each overlap group.
 *
 * Algorithm:
 * 1. Sort matches by start position
 * 2. Group overlapping matches together
 * 3. For each group, keep only the best match
 * 4. Return the resolved matches sorted by position
 */
export function resolveOverlaps(matches: DetectorMatch[]): DetectorMatch[] {
  if (matches.length === 0) {
    return [];
  }

  // Sort by start position
  const sorted = [...matches].sort((a, b) => a.start - b.start);

  const resolved: DetectorMatch[] = [];
  let currentBest = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];

    if (matchesOverlap(currentBest, current)) {
      // Overlaps with current best - choose the better one
      currentBest = chooseBetterMatch(currentBest, current);
    } else {
      // No overlap - save the current best and move to the next
      resolved.push(currentBest);
      currentBest = current;
    }
  }

  // Don't forget the last one
  resolved.push(currentBest);

  return resolved;
}
