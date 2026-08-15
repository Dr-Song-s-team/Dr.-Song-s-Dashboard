/**
 * Pure function tests for chat retrieval buildContext.
 * These tests are decoupled from Prisma - they test the formatting logic only.
 */

import { describe, it, expect } from "vitest";
import { buildContext } from "../context";
import type { Email, Patient, Document } from "@/app/generated/prisma/client";

// Mock data helpers
function createMockEmail(
  overrides: Partial<Email> = {}
): Email {
  return {
    id: "email-1",
    gmailMessageId: null,
    gmailThreadId: null,
    gmailAccountId: null,
    toInbox: "INFO" as const,
    fromName: "John Doe",
    fromEmail: "john@example.com",
    subject: "Test Subject",
    body: "Test body",
    status: "UNREAD" as const,
    classification: "GENERAL" as const,
    insurerLabel: null,
    aiSummary: null,
    aiDraft: null,
    aiAnalysis: null,
    receivedAt: new Date("2024-01-01T12:00:00Z"),
    createdAt: new Date("2024-01-01T12:00:00Z"),
    updatedAt: new Date("2024-01-01T12:00:00Z"),
    patientId: null,
    ...overrides,
  };
}

function createMockDocument(
  overrides: Partial<Document> = {}
): Document {
  return {
    id: "doc-1",
    type: "SOAP_NOTE" as const,
    status: "APPROVED" as const,
    title: "Test Document",
    fixturePath: "/fixtures/test.pdf",
    notes: null,
    content: null,
    createdAt: new Date("2024-01-01T12:00:00Z"),
    updatedAt: new Date("2024-01-01T12:00:00Z"),
    patientId: null,
    ...overrides,
  };
}

function createMockPatient(
  overrides: Partial<Patient & { emails: Email[]; documents: Document[] }> = {}
): Patient & { emails: Email[]; documents: Document[] } {
  return {
    id: "patient-1",
    firstName: "Jane",
    lastName: "Smith",
    dob: new Date("1990-01-01"),
    phone: "555-1234",
    email: "jane@example.com",
    address: "123 Main St",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    insurer: "Blue Cross",
    memberId: "BC123456",
    authLimit: 12,
    visitsUsed: 5,
    statusNotes: null,
    copayCents: null,
    deductibleCents: null,
    deductibleMetCents: null,
    paymentStatus: null,
    outstandingBalanceCents: null,
    lastPaymentDate: null,
    paymentMethod: null,
    services: [],
    servicesOther: null,
    createdAt: new Date("2024-01-01T12:00:00Z"),
    updatedAt: new Date("2024-01-01T12:00:00Z"),
    emails: [],
    documents: [],
    ...overrides,
  };
}

describe("buildContext", () => {
  it("should return empty string when no data is provided", () => {
    const context = buildContext([], [], []);
    expect(context).toBe("");
  });

  it("should format emails section correctly", () => {
    const emails = [
      createMockEmail({
        fromName: "John Doe",
        fromEmail: "john@example.com",
        subject: "Question about billing",
        aiSummary: "Patient asking about bill",
        receivedAt: new Date("2024-01-15T10:00:00Z"),
      }),
    ];

    const context = buildContext(emails, [], []);

    expect(context).toContain("=== EMAILS ===");
    expect(context).toContain("[2024-01-15]");
    expect(context).toContain("From: John Doe <john@example.com>");
    expect(context).toContain("Subject: Question about billing");
    expect(context).toContain("Summary: Patient asking about bill");
  });

  it("should format emails without summary", () => {
    const emails = [
      createMockEmail({
        fromName: "Jane Doe",
        fromEmail: "jane@example.com",
        subject: "Appointment request",
        aiSummary: null,
        receivedAt: new Date("2024-01-15T10:00:00Z"),
      }),
    ];

    const context = buildContext(emails, [], []);

    expect(context).toContain("=== EMAILS ===");
    expect(context).toContain("From: Jane Doe <jane@example.com>");
    expect(context).toContain("Subject: Appointment request");
    expect(context).not.toContain("Summary:");
  });

  it("should format patients section correctly", () => {
    const patients = [
      createMockPatient({
        firstName: "Alice",
        lastName: "Johnson",
        dob: new Date("1985-05-15"),
        insurer: "Aetna",
        authLimit: 20,
        visitsUsed: 8,
        statusNotes: "Pre-authorized for 20 visits",
        emails: [
          createMockEmail({ subject: "Follow-up appointment" }),
          createMockEmail({ subject: "Billing question" }),
        ],
        documents: [
          createMockDocument({ title: "Intake Form 1-1" }),
          createMockDocument({ title: "SOAP Note 2024-01-10" }),
        ],
      }),
    ];

    const context = buildContext([], patients, []);

    expect(context).toContain("=== PATIENTS ===");
    expect(context).toContain("Alice Johnson");
    expect(context).toContain("DOB: 1985-05-15");
    expect(context).toContain("Insurer: Aetna");
    expect(context).toContain("Auth: 8/20");
    expect(context).toContain("Status: Pre-authorized for 20 visits");
    expect(context).toContain(
      "Recent emails: Follow-up appointment; Billing question"
    );
    expect(context).toContain("Recent docs: Intake Form 1-1; SOAP Note 2024-01-10");
  });

  it("should format patients without emails and documents", () => {
    const patients = [
      createMockPatient({
        firstName: "Bob",
        lastName: "Williams",
        dob: new Date("1975-03-20"),
        insurer: "Cigna",
        authLimit: 15,
        visitsUsed: 3,
        statusNotes: null,
        emails: [],
        documents: [],
      }),
    ];

    const context = buildContext([], patients, []);

    expect(context).toContain("=== PATIENTS ===");
    expect(context).toContain("Bob Williams");
    expect(context).toContain("DOB: 1975-03-20");
    expect(context).toContain("Insurer: Cigna");
    expect(context).toContain("Auth: 3/15");
    expect(context).not.toContain("Status:");
    expect(context).not.toContain("Recent emails:");
    expect(context).not.toContain("Recent docs:");
  });

  it("should format documents section correctly", () => {
    const documents = [
      createMockDocument({
        title: "CMS-1500 Form",
        type: "CMS_1500" as const,
        notes: "Submitted to insurance",
        content: "Full text content of the document here...",
      }),
    ];

    const context = buildContext([], [], documents);

    expect(context).toContain("=== DOCUMENTS ===");
    expect(context).toContain("CMS-1500 Form (CMS_1500)");
    expect(context).toContain("Notes: Submitted to insurance");
    expect(context).toContain("Content preview: Full text content of the document here...");
  });

  it("should format documents without notes and content", () => {
    const documents = [
      createMockDocument({
        title: "Intake Form",
        type: "INTAKE_1_1" as const,
        notes: null,
        content: null,
      }),
    ];

    const context = buildContext([], [], documents);

    expect(context).toContain("=== DOCUMENTS ===");
    expect(context).toContain("Intake Form (INTAKE_1_1)");
    expect(context).not.toContain("Notes:");
    expect(context).not.toContain("Content preview:");
  });

  it("should truncate content preview at 100 characters", () => {
    const longContent = "a".repeat(200);
    const documents = [
      createMockDocument({
        title: "Long Document",
        content: longContent,
      }),
    ];

    const context = buildContext([], [], documents);

    expect(context).toContain("Content preview: " + "a".repeat(100) + "...");
  });

  it("should combine all three sections with proper spacing", () => {
    const emails = [createMockEmail({ subject: "Test Email" })];
    const patients = [createMockPatient({ firstName: "Test", lastName: "Patient" })];
    const documents = [createMockDocument({ title: "Test Doc" })];

    const context = buildContext(emails, patients, documents);

    expect(context).toContain("=== EMAILS ===");
    expect(context).toContain("=== PATIENTS ===");
    expect(context).toContain("=== DOCUMENTS ===");

    // Sections should be separated by double newlines
    const sections = context.split("\n\n");
    expect(sections.length).toBeGreaterThanOrEqual(3);
  });

  it("should truncate context at 6000 chars with marker", () => {
    // Create enough data to exceed 6000 chars
    const emails = Array.from({ length: 50 }, (_, i) => {
      const day = ((i % 28) + 1).toString().padStart(2, '0');
      return createMockEmail({
        subject: `Email ${i} with a really long subject line to increase character count`,
        aiSummary: `This is email number ${i} with a detailed summary that also adds to the character count`,
        receivedAt: new Date(`2024-01-${day}T12:00:00Z`),
      });
    });

    const context = buildContext(emails, [], []);

    expect(context.length).toBeLessThanOrEqual(6020); // 6000 + truncation marker
    expect(context).toContain("...(truncated)");
  });

  it("should not truncate context under 6000 chars", () => {
    const emails = [
      createMockEmail({
        subject: "Short subject",
        aiSummary: "Short summary",
      }),
    ];

    const context = buildContext(emails, [], []);

    expect(context.length).toBeLessThan(6000);
    expect(context).not.toContain("...(truncated)");
  });

  it("should handle multiple patients with nested data", () => {
    const patients = [
      createMockPatient({
        firstName: "Patient",
        lastName: "One",
        emails: [createMockEmail({ subject: "Email 1" })],
        documents: [createMockDocument({ title: "Doc 1" })],
      }),
      createMockPatient({
        firstName: "Patient",
        lastName: "Two",
        emails: [createMockEmail({ subject: "Email 2" })],
        documents: [createMockDocument({ title: "Doc 2" })],
      }),
    ];

    const context = buildContext([], patients, []);

    expect(context).toContain("Patient One");
    expect(context).toContain("Patient Two");
    expect(context).toContain("Recent emails: Email 1");
    expect(context).toContain("Recent emails: Email 2");
    expect(context).toContain("Recent docs: Doc 1");
    expect(context).toContain("Recent docs: Doc 2");
  });
});
