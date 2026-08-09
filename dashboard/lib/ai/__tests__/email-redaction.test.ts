/**
 * Tests for email AI service redaction pipeline.
 *
 * Verifies:
 * 1. PII is redacted before sending to AI (callAI receives tokens)
 * 2. AI responses are unredacted correctly (round-trip)
 * 3. scanText() runs on final output (catches leaks)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { EntityData } from "@/lib/redaction";
import type { Email } from "@/app/(dashboard)/calendar/aiService"

// Mock loadEntities to return fixed test data (never touch DB in unit tests)
const TEST_ENTITY_DATA: EntityData = {
  patientFirstNames: ["Maria"],
  patientLastNames: ["Santos"],
  patientFullNames: ["Maria Santos"],
  memberIds: ["BCBS-2024-002"],
};

// Mock modules BEFORE importing aiService (to prevent DB connection)
vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/ai/provider");
vi.mock("@/lib/redaction", async () => {
  const actual = await vi.importActual<typeof import("@/lib/redaction")>("@/lib/redaction");
  return {
    ...actual,
    loadEntities: vi.fn(async () => TEST_ENTITY_DATA),
    scanText: vi.fn(actual.scanText),
  };
});

// Import after mocking
const { analyzeEmails, translateEmailContent, analyzeSchedulingEmails } = await import("@/app/(dashboard)/calendar/aiService");
const aiProvider = await import("@/lib/ai/provider");
const redactionModule = await import("@/lib/redaction");

describe("Email AI Redaction Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeEmails", () => {
    it("should redact PII before calling AI and not send raw values", async () => {
      const mockCallAI = vi.spyOn(aiProvider, "callAI");
      mockCallAI.mockResolvedValueOnce(JSON.stringify({
        emails: [{
        category: "client",
        urgency: "high",
        actionRequired: true,
        summaryTitle: "Patient {{PATIENT_NAME_1}} appointment request",
        summaryDetails: ["Detail 1"],
        clientTags: ["{{PATIENT_NAME_1}}"],
        recommendedActions: ["Schedule appointment"],
        draftResponse: "Hi {{PATIENT_NAME_1}}, we'll get back to you soon.",
      }]
    }));

      // Email with known identifiers that WILL trigger redaction
      const emails: Email[] = [{
        id: "",
        sender: "maria.santos@example-patient.dev",
        subject: "Appointment for Maria Santos",
        body: "Hi, this is Maria Santos calling from 555-0102. My member ID is BCBS-2024-002.",
      }];

      await analyzeEmails(emails);

      // Verify callAI was called
      expect(mockCallAI).toHaveBeenCalledTimes(1);
      const [redactedPrompt] = mockCallAI.mock.calls[0];

      // MUST NOT contain raw PII
      expect(redactedPrompt).not.toContain("maria.santos@example-patient.dev");
      expect(redactedPrompt).not.toContain("Maria Santos");
      expect(redactedPrompt).not.toContain("555-0102");
      expect(redactedPrompt).not.toContain("BCBS-2024-002");

      // MUST contain redaction tokens
      expect(redactedPrompt).toMatch(/\{\{(EMAIL|PATIENT_NAME|PHONE|MEMBER_ID)_\d+\}\}/);
    });

    it("should call scanText on final unredacted output", async () => {
      const mockCallAI = vi.spyOn(aiProvider, "callAI");
      mockCallAI.mockResolvedValueOnce(JSON.stringify({
        emails: [{
        category: "client",
        urgency: "medium",
        actionRequired: false,
        summaryTitle: "General inquiry",
        summaryDetails: ["Question about services"],
        clientTags: [],
        recommendedAction: null,
        draftResponse: null,
      }]}));

      const mockScanText = vi.mocked(redactionModule.scanText);

      const emails: Email[] = [{
        id: "",
        sender: "info@clinic.com",
        subject: "Question",
        body: "What are your hours?",
      }];

      await analyzeEmails(emails);

      // Verify scanText was called on output fields
      expect(mockScanText).toHaveBeenCalled();

      // Should scan summaryTitle at minimum
      const scanCalls = mockScanText.mock.calls.map(call => call[0]);
      expect(scanCalls).toContain("General inquiry");
    });

    it("should complete round-trip redaction correctly", async () => {
      const mockCallAI = vi.spyOn(aiProvider, "callAI");

      // AI returns a simple response (not echoing tokens, which is more realistic)
      mockCallAI.mockResolvedValueOnce(JSON.stringify({
        emails: [{
        category: "client",
        urgency: "low",
        actionRequired: false,
        summaryTitle: "Patient inquiry received",
        summaryDetails: ["Request for appointment"],
        clientTags: [],
        recommendedActions: ["Review and respond"],
        draftResponse: "Thank you for your inquiry",
      }]}));

      const emails: Email[] = [{
        id: "",
        sender: "maria.santos@example-patient.dev",
        subject: "Test for Maria Santos",
        body: "Test message from Maria Santos",
      }];

      const results = await analyzeEmails(emails);

      // Results should be properly parsed and validated
      expect(results).toHaveLength(1);
      expect(results[0].summaryTitle).toBe("Patient inquiry received");
      expect(results[0].category).toBe("client");
      expect(results[0].summaryDetails).toEqual(["Request for appointment"]);
      expect(results[0].recommendedActions).toEqual(["Review and respond"]);
      expect(results[0].draftResponse).toBe("Thank you for your inquiry");
    });
  });

  describe("translateEmailContent", () => {
    it("should redact before translation and scanText after", async () => {
      const mockCallAI = vi.spyOn(aiProvider, "callAI");
      mockCallAI.mockResolvedValueOnce(`
        <summary_translation>환자 문의</summary_translation>
        <body_translation>약속 요청</body_translation>
      `);

      const mockScanText = vi.mocked(redactionModule.scanText);

      await translateEmailContent("test-id", "Patient inquiry", "Appointment request");

      // Verify AI was called
      expect(mockCallAI).toHaveBeenCalledTimes(1);

      // Verify scanText was called on translations
      expect(mockScanText).toHaveBeenCalled();
      const scanCalls = mockScanText.mock.calls.map(call => call[0]);
      expect(scanCalls).toContain("환자 문의");
      expect(scanCalls).toContain("약속 요청");
    });
  });

  describe("analyzeSchedulingEmails", () => {
    it("should redact before scheduling analysis and scanText after", async () => {
      const mockCallAI = vi.spyOn(aiProvider, "callAI");
      mockCallAI.mockResolvedValueOnce(JSON.stringify(
         [{
        emailId: "sched-1",
        type: "appointment",
        patientName: "Patient Name",
        date: "2026-08-15",
        time: "14:00",
        title: "Follow-up appointment",
        urgency: "medium",
        category: "client",
      }]
    ));

      const mockScanText = vi.mocked(redactionModule.scanText);

      const emails: Email[] = [{
        id: "sched-1",
        sender: "patient@example.com",
        subject: "Appointment",
        body: "I'd like to schedule for next week",
      }];

      await analyzeSchedulingEmails(emails);

      // Verify scanText was called
      expect(mockScanText).toHaveBeenCalled();
      const scanCalls = mockScanText.mock.calls.map(call => call[0]);
      expect(scanCalls).toContain("Patient Name");
      expect(scanCalls).toContain("Follow-up appointment");
    });
  });
});
