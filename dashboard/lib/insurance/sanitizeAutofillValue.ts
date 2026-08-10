/**
 * Sanitize autofill values to prevent literal "null", "N/A", "unknown" from being displayed.
 *
 * Returns null for:
 * - null/undefined inputs
 * - Empty or whitespace-only strings
 * - Placeholder values: "null", "N/A", "unknown", "na", "none", "undefined" (case-insensitive)
 *
 * Otherwise returns the trimmed value.
 */
export function sanitizeAutofillValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();

  // Empty or whitespace-only
  if (trimmed === "") {
    return null;
  }

  // Check against invalid placeholder values (case-insensitive)
  const normalized = trimmed.toLowerCase();
  const invalidValues = ["null", "n/a", "unknown", "na", "none", "undefined"];

  if (invalidValues.includes(normalized)) {
    return null;
  }

  return trimmed;
}
