/**
 * Normalize a patient name for deletion confirmation: trim whitespace and
 * collapse interior runs to a single space. Case-insensitive comparison is
 * intentionally NOT applied — the user must type the exact displayed name.
 */
export function normalizeConfirmationName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
