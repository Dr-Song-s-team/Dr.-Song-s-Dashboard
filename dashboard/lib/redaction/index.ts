/**
 * Redaction service - main exports.
 *
 * This module provides PII redaction and unredaction with layered detection:
 * - Pattern-based detection (SSN, email, phone, DOB, DOS, addresses, claim IDs, auth IDs, member IDs)
 * - Entity-based detection (patient names, member IDs from DB)
 * - Overlap resolution (keep longest/highest confidence matches)
 * - Miss detection with severity-based handling
 *
 * Usage example:
 * ```ts
 * import { loadEntities, redact, unredact, scanText } from "@/lib/redaction";
 *
 * // 1. Load entities from database (once)
 * const entities = await loadEntities();
 *
 * // 2. Redact sensitive text before sending to AI
 * const { redactedText, tokenMap } = redact(userInput, entities);
 *
 * // 3. Send redactedText to AI...
 * const aiResponse = await callAI(redactedText);
 *
 * // 4. Unredact AI response to restore original PII
 * const { originalText, unknownTokens } = unredact(aiResponse, tokenMap);
 *
 * // 5. Optionally scan for any missed PII
 * scanText(originalText); // throws on high-severity misses
 * ```
 */

// Core types
export type {
  RedactedText,
  ConfidenceLevel,
  PIIType,
  DetectorMatch,
  EntityData,
  RedactionResult,
  UnredactionResult,
  MissSeverity,
  MissDetection,
  RedactionConfig,
} from "./types";

// Main service functions
export { redact, unredact } from "./service";

// Entity loading
export { loadEntities } from "./entities";

// Miss detection
export { scanText } from "./miss-detection";

// Utility functions (exported for testing/advanced use)
export { resolveOverlaps } from "./overlap";
export {
  detectSSN,
  detectEmail,
  detectPhone,
  detectDOB,
  detectDOS,
  detectStreetAddress,
  detectCityStateZip,
  detectClaimID,
  detectAuthID,
  detectMemberID,
  detectEntities,
  runPatternDetectors,
  runAllDetectors,
  resetTokenCounter,
} from "./detectors";
