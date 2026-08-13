import { describe, it, expect } from "vitest";
import { correctTokenIndices } from "../route";

describe("correctTokenIndices", () => {
  it("corrects wrong index when only one token of that type exists", () => {
    const tokenMap = new Map([
      ["{{EMAIL_1}}", "test@example.com"],
      ["{{PERSON_1}}", "John Doe"],
    ]);

    const text = `The email is {{EMAIL_2}} and the person is {{PERSON_1}}`;
    const result = correctTokenIndices(text, tokenMap);

    expect(result.correctedText).toBe(
      "The email is {{EMAIL_1}} and the person is {{PERSON_1}}"
    );
    expect(result.corrections).toEqual(["{{EMAIL_2}} → {{EMAIL_1}}"]);
  });

  it("corrects multiple wrong indices of the same type", () => {
    const tokenMap = new Map([["{{EMAIL_1}}", "test@example.com"]]);

    const text = `First: {{EMAIL_2}}, Second: {{EMAIL_3}}, Third: {{EMAIL_4}}`;
    const result = correctTokenIndices(text, tokenMap);

    expect(result.correctedText).toBe(
      "First: {{EMAIL_1}}, Second: {{EMAIL_1}}, Third: {{EMAIL_1}}"
    );
    expect(result.corrections).toEqual([
      "{{EMAIL_2}} → {{EMAIL_1}}",
      "{{EMAIL_3}} → {{EMAIL_1}}",
      "{{EMAIL_4}} → {{EMAIL_1}}",
    ]);
  });

  it("does not correct when token exists in map (correct index)", () => {
    const tokenMap = new Map([
      ["{{EMAIL_1}}", "test@example.com"],
      ["{{PERSON_1}}", "John Doe"],
    ]);

    const text = `The email is {{EMAIL_1}} and the person is {{PERSON_1}}`;
    const result = correctTokenIndices(text, tokenMap);

    expect(result.correctedText).toBe(text);
    expect(result.corrections).toEqual([]);
  });

  it("does not correct when multiple candidates exist (ambiguous)", () => {
    const tokenMap = new Map([
      ["{{PERSON_1}}", "John Doe"],
      ["{{PERSON_2}}", "Jane Smith"],
    ]);

    const text = `The person is {{PERSON_3}}`;
    const result = correctTokenIndices(text, tokenMap);

    // Should NOT correct because there are 2 PERSON tokens - ambiguous
    expect(result.correctedText).toBe(text);
    expect(result.corrections).toEqual([]);
  });

  it("corrects single-candidate type while leaving ambiguous types unchanged", () => {
    const tokenMap = new Map([
      ["{{EMAIL_1}}", "test@example.com"],
      ["{{PERSON_1}}", "John Doe"],
      ["{{PERSON_2}}", "Jane Smith"],
    ]);

    const text = `Email: {{EMAIL_2}}, Person: {{PERSON_3}}`;
    const result = correctTokenIndices(text, tokenMap);

    // EMAIL_2 → EMAIL_1 (single candidate)
    // PERSON_3 unchanged (multiple candidates, ambiguous)
    expect(result.correctedText).toBe(
      "Email: {{EMAIL_1}}, Person: {{PERSON_3}}"
    );
    expect(result.corrections).toEqual(["{{EMAIL_2}} → {{EMAIL_1}}"]);
  });

  it("handles text with no tokens", () => {
    const tokenMap = new Map([["{{EMAIL_1}}", "test@example.com"]]);
    const text = "Plain text with no tokens";
    const result = correctTokenIndices(text, tokenMap);

    expect(result.correctedText).toBe(text);
    expect(result.corrections).toEqual([]);
  });

  it("handles empty token map", () => {
    const tokenMap = new Map();
    const text = "Text with {{EMAIL_1}} token";
    const result = correctTokenIndices(text, tokenMap);

    // No valid tokens in map, so nothing can be corrected
    expect(result.correctedText).toBe(text);
    expect(result.corrections).toEqual([]);
  });

  it("corrects JSON with nested tokens", () => {
    const tokenMap = new Map([
      ["{{EMAIL_1}}", "test@example.com"],
      ["{{PERSON_1}}", "John Doe"],
    ]);

    const jsonText = `{
  "clientTags": ["{{PERSON_2}}"],
  "summaryTitle": "{{PERSON_3}} sent email from {{EMAIL_2}}"
}`;

    const result = correctTokenIndices(jsonText, tokenMap);

    const expectedJson = `{
  "clientTags": ["{{PERSON_1}}"],
  "summaryTitle": "{{PERSON_1}} sent email from {{EMAIL_1}}"
}`;

    expect(result.correctedText).toBe(expectedJson);
    expect(result.corrections).toContain("{{PERSON_2}} → {{PERSON_1}}");
    expect(result.corrections).toContain("{{PERSON_3}} → {{PERSON_1}}");
    expect(result.corrections).toContain("{{EMAIL_2}} → {{EMAIL_1}}");
  });

  it("preserves tokens with different types", () => {
    const tokenMap = new Map([
      ["{{EMAIL_1}}", "test@example.com"],
      ["{{PHONE_1}}", "555-1234"],
    ]);

    const text = `Email: {{EMAIL_2}}, Phone: {{PHONE_3}}`;
    const result = correctTokenIndices(text, tokenMap);

    // Both should be corrected (single candidate each)
    expect(result.correctedText).toBe(
      "Email: {{EMAIL_1}}, Phone: {{PHONE_1}}"
    );
    expect(result.corrections).toEqual([
      "{{EMAIL_2}} → {{EMAIL_1}}",
      "{{PHONE_3}} → {{PHONE_1}}",
    ]);
  });
});
