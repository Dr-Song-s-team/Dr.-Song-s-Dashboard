import { describe, it, expect } from "vitest";
import { sanitizeAutofillValue } from "../sanitizeAutofillValue";

describe("sanitizeAutofillValue", () => {
  describe("null and undefined inputs", () => {
    it("returns null for null input", () => {
      expect(sanitizeAutofillValue(null)).toBe(null);
    });

    it("returns null for undefined input", () => {
      expect(sanitizeAutofillValue(undefined)).toBe(null);
    });
  });

  describe("empty and whitespace strings", () => {
    it("returns null for empty string", () => {
      expect(sanitizeAutofillValue("")).toBe(null);
    });

    it("returns null for whitespace-only string", () => {
      expect(sanitizeAutofillValue("   ")).toBe(null);
      expect(sanitizeAutofillValue("\t\n")).toBe(null);
    });
  });

  describe("placeholder value 'null'", () => {
    it("returns null for 'null' (lowercase)", () => {
      expect(sanitizeAutofillValue("null")).toBe(null);
    });

    it("returns null for 'NULL' (uppercase)", () => {
      expect(sanitizeAutofillValue("NULL")).toBe(null);
    });

    it("returns null for 'Null' (mixed case)", () => {
      expect(sanitizeAutofillValue("Null")).toBe(null);
    });

    it("returns null for 'null' with whitespace", () => {
      expect(sanitizeAutofillValue("  null  ")).toBe(null);
    });
  });

  describe("placeholder value 'N/A'", () => {
    it("returns null for 'N/A'", () => {
      expect(sanitizeAutofillValue("N/A")).toBe(null);
    });

    it("returns null for 'n/a' (lowercase)", () => {
      expect(sanitizeAutofillValue("n/a")).toBe(null);
    });

    it("returns null for 'NA'", () => {
      expect(sanitizeAutofillValue("NA")).toBe(null);
    });

    it("returns null for 'na' (lowercase)", () => {
      expect(sanitizeAutofillValue("na")).toBe(null);
    });
  });

  describe("placeholder value 'unknown'", () => {
    it("returns null for 'unknown'", () => {
      expect(sanitizeAutofillValue("unknown")).toBe(null);
    });

    it("returns null for 'UNKNOWN' (uppercase)", () => {
      expect(sanitizeAutofillValue("UNKNOWN")).toBe(null);
    });

    it("returns null for 'Unknown' (mixed case)", () => {
      expect(sanitizeAutofillValue("Unknown")).toBe(null);
    });
  });

  describe("other placeholder values", () => {
    it("returns null for 'none'", () => {
      expect(sanitizeAutofillValue("none")).toBe(null);
      expect(sanitizeAutofillValue("NONE")).toBe(null);
    });

    it("returns null for 'undefined'", () => {
      expect(sanitizeAutofillValue("undefined")).toBe(null);
      expect(sanitizeAutofillValue("UNDEFINED")).toBe(null);
    });
  });

  describe("valid values are preserved", () => {
    it("preserves normal text", () => {
      expect(sanitizeAutofillValue("John Doe")).toBe("John Doe");
    });

    it("preserves numbers as strings", () => {
      expect(sanitizeAutofillValue("123")).toBe("123");
      expect(sanitizeAutofillValue("12345")).toBe("12345");
    });

    it("preserves dates", () => {
      expect(sanitizeAutofillValue("2024-07-01")).toBe("2024-07-01");
    });

    it("preserves diagnosis codes", () => {
      expect(sanitizeAutofillValue("M54.5")).toBe("M54.5");
      expect(sanitizeAutofillValue("S13.4")).toBe("S13.4");
    });

    it("preserves addresses", () => {
      expect(sanitizeAutofillValue("123 Main St, Los Angeles, CA 90001")).toBe(
        "123 Main St, Los Angeles, CA 90001"
      );
    });

    it("trims whitespace from valid values", () => {
      expect(sanitizeAutofillValue("  Valid Text  ")).toBe("Valid Text");
    });

    it("preserves redaction tokens", () => {
      expect(sanitizeAutofillValue("{{PATIENT_NAME_17}}")).toBe("{{PATIENT_NAME_17}}");
      expect(sanitizeAutofillValue("{{DOB_5}}")).toBe("{{DOB_5}}");
    });

    it("preserves text containing placeholder words as substrings", () => {
      // "unknown" as part of a larger phrase should NOT be filtered
      expect(sanitizeAutofillValue("unknown diagnosis")).toBe("unknown diagnosis");
      expect(sanitizeAutofillValue("The null hypothesis")).toBe("The null hypothesis");
    });
  });
});
