/**
 * Pure post-processing functions for AI email analysis.
 * No external dependencies (no prisma, no env vars) - safe for unit testing.
 */

/**
 * Strips leftover redaction tokens (e.g., {{EMAIL_2}}, {{PERSON_1}}) from text.
 * Replaces them with "[unavailable]" so users never see raw tokens.
 */
export function stripLeftoverTokens(text: string): string {
  return text.replace(/\{\{[A-Z_0-9]+\}\}/g, "[unavailable]");
}

/**
 * Extracts the list of valid tokens from a tokenMap.
 * Returns an array like ["{{EMAIL_1}}", "{{PERSON_1}}", "{{PERSON_2}}"].
 */
export function extractValidTokens(tokenMap: Map<string, string>): string[] {
  return Array.from(tokenMap.keys()).sort();
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Corrects hallucinated token indices in AI output.
 * If the AI wrote {{EMAIL_2}} but only {{EMAIL_1}} exists in the map,
 * and there's exactly ONE email token, substitute it.
 * Only single-candidate corrections; ambiguous cases fall through.
 */
export function correctTokenIndices(
  text: string,
  tokenMap: Map<string, string>
): { correctedText: string; corrections: string[] } {
  const corrections: string[] = [];

  // Build a map of token type → valid tokens of that type
  const tokensByType = new Map<string, string[]>();
  for (const token of tokenMap.keys()) {
    // Extract type from token like {{EMAIL_1}} → EMAIL
    const match = token.match(/^\{\{([A-Z_]+)_\d+\}\}$/);
    if (match) {
      const type = match[1];
      if (!tokensByType.has(type)) {
        tokensByType.set(type, []);
      }
      tokensByType.get(type)!.push(token);
    }
  }

  // Find all tokens in the text
  let correctedText = text;
  const tokenRegex = /\{\{([A-Z_]+)_(\d+)\}\}/g;
  const matches = Array.from(text.matchAll(tokenRegex));

  for (const match of matches) {
    const fullToken = match[0]; // e.g., "{{EMAIL_2}}"
    const type = match[1]; // e.g., "EMAIL"

    // If this token exists in the map, no correction needed
    if (tokenMap.has(fullToken)) {
      continue;
    }

    // Check if there's exactly ONE valid token of this type
    const validTokensOfType = tokensByType.get(type) || [];
    if (validTokensOfType.length === 1) {
      // Single candidate - safe to substitute
      const correctToken = validTokensOfType[0];
      correctedText = correctedText.replace(new RegExp(escapeRegex(fullToken), 'g'), correctToken);
      corrections.push(`${fullToken} → ${correctToken}`);
    }
    // If multiple or zero candidates, fall through (will become [unavailable])
  }

  return { correctedText, corrections };
}

/**
 * Determines if a sender appears to be an organization/department rather than a person.
 * Uses heuristics based on fromName and fromEmail patterns.
 */
export function isOrganizationalSender(fromName: string, fromEmail: string): boolean {
  const nameLower = fromName.trim().toLowerCase();
  const emailLocalPart = fromEmail.split("@")[0]?.toLowerCase() || "";

  // Common department/organizational keywords
  const organizationalKeywords = [
    "claims",
    "billing",
    "support",
    "noreply",
    "no-reply",
    "admin",
    "info",
    "notifications",
    "notification",
    "team",
    "service",
    "services",
    "dept",
    "department",
    "hello",
    "help",
    "contact",
    "customerservice",
    "customer service",
    "accounts",
    "payroll",
    "hr",
    "human resources",
    "reception",
    "office",
  ];

  // Check if fromName matches organizational keywords (whole word matches)
  // Use word boundaries to avoid false positives like "hr" in "chris"
  for (const keyword of organizationalKeywords) {
    if (nameLower === keyword) {
      return true;
    }
    // For multi-word keywords like "human resources", escape spaces
    const escapedKeyword = keyword.replace(/\s+/g, '\\s+');
    const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
    if (regex.test(nameLower)) {
      return true;
    }
  }

  // Check email local-part for organizational keywords (whole word matches)
  // Use word boundaries to avoid false positives like "hr" in "chris"
  for (const keyword of organizationalKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(emailLocalPart)) {
      return true;
    }
  }

  // Analyze single-word names
  const words = nameLower.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    // Check if it's a proper name format (e.g., "Madonna", "Alice")
    const isProperName = /^[A-Z][a-z]+$/.test(fromName.trim());

    // If it's a proper name, treat as human regardless of email
    if (isProperName) {
      return false;
    }

    // If name equals email local-part AND it's not a proper name (e.g., "noreply" from "noreply@...")
    if (nameLower === emailLocalPart) {
      return true;
    }

    // Single word, not proper name format, likely organizational
    // (e.g., "CLAIMS", "support", "no-reply")
    if (words[0].length <= 15) {
      return true;
    }
  }

  return false;
}

/**
 * Post-processes draft response to fix [unavailable] in greetings.
 * For human senders: replaces [unavailable] with the sender's first name.
 * For organizational senders: replaces personal greetings with neutral "Hello,".
 */
export function fixDraftGreeting(
  draftResponse: string,
  senderName: string,
  senderEmail: string
): string {
  const isOrg = isOrganizationalSender(senderName, senderEmail);

  // Match common greeting patterns at the start of the draft
  // Captures: greeting word, recipient, and optional comma
  const greetingPattern = /^(Dear|Hello|Hi)\s+(\[unavailable\]|[^,\n]+)(,?)/i;
  const match = draftResponse.match(greetingPattern);

  if (!match) {
    return draftResponse;
  }

  const greetingWord = match[1]; // "Dear", "Hello", "Hi"
  const recipientPart = match[2]; // "[unavailable]", "Claims", "John", etc.
  const hasComma = match[3] === ",";

  if (isOrg) {
    // For organizational senders, use neutral greeting
    // Replace "Dear [anything]" or "Hello [anything]" with "Hello,"
    return draftResponse.replace(greetingPattern, "Hello,");
  } else {
    // For human senders, only fix if it's [unavailable]
    if (recipientPart === "[unavailable]") {
      // Extract first name from full name (e.g., "John Doe" → "John")
      const firstName = senderName.trim().split(/\s+/)[0];
      const comma = hasComma ? "," : "";
      return draftResponse.replace(greetingPattern, `${greetingWord} ${firstName}${comma}`);
    }
  }

  return draftResponse;
}
