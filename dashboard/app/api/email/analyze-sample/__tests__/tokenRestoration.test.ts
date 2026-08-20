/**
 * Regression test for token restoration bug (Aug 20, 2026)
 *
 * Bug: analyze-sample route and translateEmailContent were passing
 * finalRedaction.tokenMap to unredact(), but that map was empty because
 * finalRedaction was created by re-redacting already-redacted text.
 *
 * Fix: Pass the merged tokenMap instead.
 *
 * This test ensures that when the pipeline redacts multiple fields
 * (sender, subject, body), merges their tokens, and then calls AI,
 * the final output contains the REAL values, not "[unavailable]".
 */

import { describe, it, expect } from "vitest";
import { redact, unredact } from "@/lib/redaction/service";
import type { EntityData } from "@/lib/redaction/types";
import { correctTokenIndices } from "@/lib/ai/analysisPostprocess";

describe("Token restoration regression (Aug 20, 2026 bug)", () => {
  it("full pipeline: redact → merge → AI response → unredact → real values", () => {
    // Synthetic entities
    const entities: EntityData = {
      patientFirstNames: ["David"],
      patientLastNames: ["Rivera"],
      patientFullNames: ["David Rivera"],
      memberIds: ["CIG-2024-005"],
    };

    // Simulate route.ts redaction pipeline
    const fromEmail = "schen@injury-law-dummy.example";
    const subject = "PI Report Request — David Rivera / MVA May 15, 2024";
    const body =
      "Dear Dr. Song, I am representing Mr. David Rivera (DOB 9/12/1953, member CIG-2024-005) in a personal injury case.";

    // Step 1: Redact each field individually
    const senderRedaction = redact(fromEmail, entities);
    const subjectRedaction = redact(subject, entities);
    const bodyRedaction = redact(body, entities);

    // Step 2: Merge token maps (the critical fix)
    const mergedTokenMap = new Map<string, string>([
      ...senderRedaction.tokenMap,
      ...subjectRedaction.tokenMap,
      ...bodyRedaction.tokenMap,
    ]);

    // Step 3: Build prompt from already-redacted text
    const prompt = `From: ${senderRedaction.redactedText}
Subject: ${subjectRedaction.redactedText}
Body: ${bodyRedaction.redactedText}`;

    // Step 4: Call redact() again (for RedactedText branded type)
    const finalRedaction = redact(prompt, entities);

    // CRITICAL ASSERTION: finalRedaction.tokenMap should be EMPTY
    // because prompt contains tokens, not real PII
    expect(finalRedaction.tokenMap.size).toBe(0);

    // But mergedTokenMap should have all the tokens
    expect(mergedTokenMap.size).toBeGreaterThan(0);

    // Get the actual tokens from the map (they won't be _1 because of multiple redact() calls)
    const emailToken = [...mergedTokenMap.keys()].find(k => k.startsWith("{{EMAIL_"));
    const patientNameToken = [...mergedTokenMap.keys()].find(k => k.startsWith("{{PATIENT_NAME_"));
    const dobToken = [...mergedTokenMap.keys()].find(k => k.startsWith("{{DOB_"));
    const memberIdToken = [...mergedTokenMap.keys()].find(k => k.startsWith("{{MEMBER_ID_"));

    // Step 5: Simulate AI response that copies tokens verbatim from the input
    const mockAIResponse = `{
  "emails": [{
    "summaryTitle": "Attorney for Mr. ${patientNameToken} requested PI report",
    "clientTags": ["${patientNameToken}"],
    "draftResponse": "Dear ${emailToken}, thank you for your request for ${patientNameToken}. DOB ${dobToken}, member ${memberIdToken}."
  }]
}`;

    // Step 6: Correct token indices (if needed)
    const { correctedText } = correctTokenIndices(mockAIResponse, mergedTokenMap);

    // Step 7: Unredact using the MERGED map (NOT finalRedaction.tokenMap)
    const { originalText, unknownTokens } = unredact(correctedText, mergedTokenMap);

    // REGRESSION CHECK: No unknown tokens - all should be restored
    expect(unknownTokens).toEqual([]);

    // REGRESSION CHECK: Original values should appear in output
    expect(originalText).toContain("David Rivera");
    expect(originalText).toContain("9/12/1953");
    expect(originalText).toContain("CIG-2024-005");
    expect(originalText).toContain("schen@injury-law-dummy.example");

    // REGRESSION CHECK: No [unavailable] placeholders
    expect(originalText).not.toContain("[unavailable]");

    // REGRESSION CHECK: No leftover tokens
    expect(originalText).not.toMatch(/\{\{[A-Z_]+_\d+\}\}/);
  });

  it("wrong map: passing empty finalRedaction.tokenMap causes [unavailable]", () => {
    // This test documents the BUG behavior (what happens if we use the wrong map)

    const entities: EntityData = {
      patientFirstNames: ["Jane"],
      patientLastNames: ["Doe"],
      patientFullNames: ["Jane Doe"],
      memberIds: ["ABC-123"],
    };

    const senderRedaction = redact("sender@example.com", entities);
    const subjectRedaction = redact("Subject about Jane Doe", entities);
    const bodyRedaction = redact("Body mentioning Jane Doe and ABC-123", entities);

    // Merge tokens (correct step)
    const mergedTokenMap = new Map<string, string>([
      ...senderRedaction.tokenMap,
      ...subjectRedaction.tokenMap,
      ...bodyRedaction.tokenMap,
    ]);

    // Build prompt from redacted text
    const prompt = `From: ${senderRedaction.redactedText}\nSubject: ${subjectRedaction.redactedText}\nBody: ${bodyRedaction.redactedText}`;

    // Re-redact the prompt (gets empty map because tokens aren't real PII)
    const finalRedaction = redact(prompt, entities);

    // Get actual tokens from merged map
    const patientToken = [...mergedTokenMap.keys()].find(k => k.startsWith("{{PATIENT_NAME_"));
    const memberToken = [...mergedTokenMap.keys()].find(k => k.startsWith("{{MEMBER_ID_"));

    // Simulate AI response with tokens (using actual tokens from the map)
    const mockAIResponse = `Summary: ${patientToken} with member ${memberToken}`;

    // BUG: If we use finalRedaction.tokenMap (empty), tokens become unknown
    const { originalText: buggedText, unknownTokens: buggedUnknown } = unredact(
      mockAIResponse,
      finalRedaction.tokenMap // ❌ WRONG MAP (empty)
    );

    // Bug behavior: unknownTokens should contain all tokens from AI response
    expect(buggedUnknown.length).toBeGreaterThan(0);
    expect(buggedUnknown).toContain(patientToken);
    expect(buggedUnknown).toContain(memberToken);

    // Bug behavior: originalText still contains tokens (because they couldn't be restored)
    expect(buggedText).toContain(patientToken);
    expect(buggedText).toContain(memberToken);

    // FIX: Use mergedTokenMap instead
    const { originalText: fixedText, unknownTokens: fixedUnknown } = unredact(
      mockAIResponse,
      mergedTokenMap // ✅ CORRECT MAP (merged)
    );

    // Fixed behavior: No unknown tokens
    expect(fixedUnknown).toEqual([]);

    // Fixed behavior: Real values restored
    expect(fixedText).toContain("Jane Doe");
    expect(fixedText).toContain("ABC-123");
    expect(fixedText).not.toMatch(/\{\{[A-Z_]+_\d+\}\}/);
  });
});
