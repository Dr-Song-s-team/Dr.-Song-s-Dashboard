/**
 * Core types for the redaction service.
 *
 * The redaction system uses a layered detection approach:
 * 1. Pattern-based detectors (SSN, email, phone, medical terms)
 * 2. Entity-based detection (patient names, insurers, etc.)
 * 3. Miss detection with severity-based handling
 */

/**
 * Branded type for redacted text to prevent accidental use of plain strings
 * where redacted text is expected.
 */
export type RedactedText = string & { readonly __brand: "RedactedText" };

/**
 * Confidence level for a detection match.
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Type of PII detected.
 */
export type PIIType =
  | "ssn"
  | "email"
  | "phone"
  | "dob"
  | "date_of_service"
  | "patient_name"
  | "member_id"
  | "address"
  | "claim_id"
  | "auth_id"
  | "generic_entity";

/**
 * A single detection match from a detector.
 */
export interface DetectorMatch {
  /** Zero-based start index in the original text */
  start: number;
  /** Zero-based end index (exclusive) in the original text */
  end: number;
  /** Type of PII detected */
  type: PIIType;
  /** Confidence level of the match */
  confidence: ConfidenceLevel;
  /** Original text that was matched */
  originalText: string;
  /** Unique token to use for replacement (e.g., "{{SSN_1}}", "{{PATIENT_NAME_1}}") */
  token: string;
}

/**
 * Entity data loaded from the database for entity-based detection.
 */
export interface EntityData {
  /** Patient first names */
  patientFirstNames: string[];
  /** Patient last names */
  patientLastNames: string[];
  /** Full patient names (firstName + lastName) */
  patientFullNames: string[];
  /** Member IDs */
  memberIds: string[];
}

/**
 * Result of the redaction process.
 */
export interface RedactionResult {
  /** The redacted text with tokens replacing PII */
  redactedText: RedactedText;
  /** Map of tokens to their original values for unredaction */
  tokenMap: Map<string, string>;
  /** All matches that were found and redacted */
  matches: DetectorMatch[];
}

/**
 * Result of the unredaction process.
 */
export interface UnredactionResult {
  /** The original text with PII restored */
  originalText: string;
  /** Tokens that were found in the redacted text but not in the token map */
  unknownTokens: string[];
}

/**
 * Severity level for miss detection.
 */
export type MissSeverity = "high" | "low";

/**
 * A potential PII miss detected in redacted text.
 */
export interface MissDetection {
  /** The suspicious text that might be PII */
  text: string;
  /** Zero-based start index */
  start: number;
  /** Zero-based end index (exclusive) */
  end: number;
  /** Type of PII suspected */
  type: PIIType;
  /** Severity of the miss */
  severity: MissSeverity;
  /** Reason why this is flagged as a potential miss */
  reason: string;
}

/**
 * Configuration for the redaction service.
 */
export interface RedactionConfig {
  /** Whether to throw on high-severity misses in scanText() */
  throwOnHighSeverityMiss?: boolean;
  /** Whether to log warnings for low-severity misses */
  logLowSeverityMisses?: boolean;
}
