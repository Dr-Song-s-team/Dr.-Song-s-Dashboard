/**
 * Pattern-based and entity-based detectors for PII.
 *
 * All detectors are pure functions that take text (and optionally entities)
 * and return an array of DetectorMatch objects.
 */

import type { DetectorMatch, EntityData, PIIType } from "./types";

/**
 * Counter for generating unique tokens across all detector types.
 */
let tokenCounter = 0;

/**
 * Reset the token counter (useful for testing).
 */
export function resetTokenCounter(): void {
  tokenCounter = 0;
}

/**
 * Generate a unique token for a given PII type and original text.
 * Returns the same token if the same (type, text) pair has been seen before in this cache.
 */
function generateToken(type: PIIType, originalText: string, cache: Map<string, string>): string {
  const cacheKey = `${type}:${originalText.toLowerCase()}`;

  // Check if we've already generated a token for this exact text
  const cachedToken = cache.get(cacheKey);
  if (cachedToken) {
    return cachedToken;
  }

  // Generate new token
  tokenCounter += 1;
  const typeUpper = type.toUpperCase().replace(/_/g, "_");
  const newToken = `{{${typeUpper}_${tokenCounter}}}`;

  // Cache it for future use
  cache.set(cacheKey, newToken);

  return newToken;
}

/**
 * Detect Social Security Numbers (SSN).
 * Patterns: XXX-XX-XXXX or XXXXXXXXX
 */
export function detectSSN(text: string, cache: Map<string, string>): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  // Pattern: XXX-XX-XXXX or XXX XX XXXX
  const ssnRegex = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;

  let match: RegExpExecArray | null;
  while ((match = ssnRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "ssn",
      confidence: "high",
      originalText: match[0],
      token: generateToken("ssn", match[0], cache),
    });
  }

  return matches;
}

/**
 * Detect email addresses.
 */
export function detectEmail(text: string, cache: Map<string, string>): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  // Simple email pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

  let match: RegExpExecArray | null;
  while ((match = emailRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "email",
      confidence: "high",
      originalText: match[0],
      token: generateToken("email", match[0], cache),
    });
  }

  return matches;
}

/**
 * Detect phone numbers.
 * Patterns: (XXX) XXX-XXXX, XXX-XXX-XXXX, XXX.XXX.XXXX, XXX-XXXX, XXXXXXXXXX
 */
export function detectPhone(text: string, cache: Map<string, string>): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  // Pattern for various phone formats including 7-digit local numbers
  const phoneRegex =
    /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b|\b[0-9]{3}[-.\s][0-9]{4}\b/g;

  let match: RegExpExecArray | null;
  while ((match = phoneRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "phone",
      confidence: "high",
      originalText: match[0],
      token: generateToken("phone", match[0], cache),
    });
  }

  return matches;
}

/**
 * Detect dates that might be dates of birth.
 * Patterns: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD
 */
export function detectDOB(text: string, cache: Map<string, string>): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  // Pattern for common date formats
  const dobRegex =
    /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12][0-9]|3[01])[/-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[/-](?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12][0-9]|3[01])\b/g;

  let match: RegExpExecArray | null;
  while ((match = dobRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "dob",
      confidence: "medium",
      originalText: match[0],
      token: generateToken("dob", match[0], cache),
    });
  }

  return matches;
}

/**
 * Detect date of service (DOS) patterns.
 * Patterns: "DOS YYYY-MM-DD" or "DOS: YYYY-MM-DD"
 */
export function detectDOS(text: string, cache: Map<string, string>): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  // Pattern: DOS followed by optional colon/space and a date in YYYY-MM-DD format
  const dosRegex = /\bDOS:?\s*(\d{4}-\d{2}-\d{2})\b/gi;

  let match: RegExpExecArray | null;
  while ((match = dosRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "date_of_service",
      confidence: "high",
      originalText: match[0],
      token: generateToken("date_of_service", match[0], cache),
    });
  }

  return matches;
}

/**
 * Detect street addresses.
 * Pattern: Number followed by street name (e.g., "200 Oak Ave", "123 Main Street")
 */
export function detectStreetAddress(text: string, cache: Map<string, string>): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  // Pattern: digits followed by one or more words (street name)
  const addressRegex = /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place))\.?\b/g;

  let match: RegExpExecArray | null;
  while ((match = addressRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "address",
      confidence: "high",
      originalText: match[0],
      token: generateToken("address", match[0], cache),
    });
  }

  return matches;
}

/**
 * Detect city, state, zip patterns.
 * Pattern: "City, ST 12345" or "City, ST 12345-6789"
 */
export function detectCityStateZip(text: string, cache: Map<string, string>): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  // Pattern: City name, two-letter state code, and optional zip
  const cityStateZipRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g;

  let match: RegExpExecArray | null;
  while ((match = cityStateZipRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "address",
      confidence: "high",
      originalText: match[0],
      token: generateToken("address", match[0], cache),
    });
  }

  return matches;
}

/**
 * Detect claim IDs.
 * Pattern: CLM-####-####
 */
export function detectClaimID(text: string, cache: Map<string, string>): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  const claimRegex = /\bCLM-\d{4}-\d{4}\b/g;

  let match: RegExpExecArray | null;
  while ((match = claimRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "claim_id",
      confidence: "high",
      originalText: match[0],
      token: generateToken("claim_id", match[0], cache),
    });
  }

  return matches;
}

/**
 * Detect authorization IDs.
 * Pattern: AUTH-####-##-###
 */
export function detectAuthID(text: string, cache: Map<string, string>): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  const authRegex = /\bAUTH-\d{4}-\d{2}-\d{3}\b/g;

  let match: RegExpExecArray | null;
  while ((match = authRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "auth_id",
      confidence: "high",
      originalText: match[0],
      token: generateToken("auth_id", match[0], cache),
    });
  }

  return matches;
}

/**
 * Detect member IDs by pattern.
 * Pattern: [A-Z]{2,4}-####-###
 */
export function detectMemberID(text: string, cache: Map<string, string>): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  const memberIdRegex = /\b[A-Z]{2,4}-\d{4}-\d{3}\b/g;

  let match: RegExpExecArray | null;
  while ((match = memberIdRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "member_id",
      confidence: "high",
      originalText: match[0],
      token: generateToken("member_id", match[0], cache),
    });
  }

  return matches;
}

/**
 * Detect patient entities (names, member IDs, etc.) from the entity data.
 * This detector requires entity data to be passed in.
 */
export function detectEntities(
  text: string,
  entities: EntityData,
  cache: Map<string, string>
): DetectorMatch[] {
  const matches: DetectorMatch[] = [];

  // Detect full patient names (high confidence)
  for (const fullName of entities.patientFullNames) {
    if (!fullName) continue;
    const escaped = fullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: "patient_name",
        confidence: "high",
        originalText: match[0],
        token: generateToken("patient_name", match[0], cache),
      });
    }
  }

  // Detect first names (medium confidence)
  for (const firstName of entities.patientFirstNames) {
    if (!firstName) continue;
    const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      // Check if this isn't already part of a full name match
      const alreadyMatched = matches.some(
        (m) => match!.index >= m.start && match!.index < m.end
      );
      if (!alreadyMatched) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type: "patient_name",
          confidence: "medium",
          originalText: match[0],
          token: generateToken("patient_name", match[0], cache),
        });
      }
    }
  }

  // Detect last names (medium confidence)
  for (const lastName of entities.patientLastNames) {
    if (!lastName) continue;
    const escaped = lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      // Check if this isn't already part of a full or first name match
      const alreadyMatched = matches.some(
        (m) => match!.index >= m.start && match!.index < m.end
      );
      if (!alreadyMatched) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type: "patient_name",
          confidence: "medium",
          originalText: match[0],
          token: generateToken("patient_name", match[0], cache),
        });
      }
    }
  }

  // Detect member IDs (high confidence)
  for (const memberId of entities.memberIds) {
    if (!memberId) continue;
    const escaped = memberId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: "member_id",
        confidence: "high",
        originalText: match[0],
        token: generateToken("member_id", match[0], cache),
      });
    }
  }

  return matches;
}

/**
 * Run all pattern-based detectors on the given text.
 */
export function runPatternDetectors(text: string, cache: Map<string, string>): DetectorMatch[] {
  return [
    ...detectSSN(text, cache),
    ...detectEmail(text, cache),
    ...detectPhone(text, cache),
    ...detectDOB(text, cache),
    ...detectDOS(text, cache),
    ...detectStreetAddress(text, cache),
    ...detectCityStateZip(text, cache),
    ...detectClaimID(text, cache),
    ...detectAuthID(text, cache),
    ...detectMemberID(text, cache),
  ];
}

/**
 * Run all detectors (pattern-based + entity-based) on the given text.
 */
export function runAllDetectors(
  text: string,
  entities: EntityData,
  cache: Map<string, string>
): DetectorMatch[] {
  return [...runPatternDetectors(text, cache), ...detectEntities(text, entities, cache)];
}
