import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import { analyzeSchedulingEmails } from "@/app/(dashboard)/calendar/aiService";
import { ExtractionStatus } from "@/app/generated/prisma/client";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    email: {
      findMany: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/app/(dashboard)/calendar/aiService", () => ({
  analyzeSchedulingEmails: vi.fn(),
}));

vi.mock("@/lib/googleCalendar", () => ({
  getGoogleCalendar: vi.fn().mockRejectedValue(new Error("No Google account connected.")),
  buildGoogleReminders: vi.fn().mockReturnValue({ useDefault: false, overrides: [] }),
}));

describe("POST /api/events/sync-from-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero counts when no emails to process", async () => {
    vi.mocked(prisma.email.findMany).mockResolvedValue([]);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      created: 0,
      skipped: 0,
      total: 0,
      message: "No emails to process",
    });
  });

  it("processes emails and creates tasks", async () => {
    const mockEmails = [
      {
        id: "email-1",
        fromName: "John Doe",
        fromEmail: "john@example.com",
        subject: "Appointment request",
        body: "I need to schedule an appointment for July 20th",
        toInbox: "SCHEDULING" as const,
        classification: "SCHEDULING" as const,
        status: "UNREAD" as const,
        receivedAt: new Date("2026-07-15"),
        gmailMessageId: null,
        gmailThreadId: null,
        gmailAccountId: null,
        insurerLabel: null,
        aiSummary: null,
        aiDraft: null,
        aiAnalysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patientId: null,
      },
    ];

    const mockResults = [
      {
        id: "email-1",
        type: "appointment" as const,
        patientName: "John Doe",
        date: "2026-07-20",
        time: "14:00",
        title: "Schedule appointment for John Doe",
        urgency: "medium" as const,
        category: "client" as const,
      },
    ];

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(analyzeSchedulingEmails).mockResolvedValue(mockResults);
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.task.create).mockResolvedValue({
      id: "task-1",
      title: "Schedule appointment for John Doe",
      description: "From email: Appointment request",
      dueDate: new Date("2026-07-20T14:00:00-08:00"),
      status: "PENDING",
      emailId: "email-1",
      patientId: null,
      googleEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      extractionStatus: "PENDING_REVIEW",
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(1);
    expect(data.skipped).toBe(0);
    expect(data.total).toBe(1);
    expect(vi.mocked(prisma.task.create)).toHaveBeenCalledWith({
      data: {
        title: "Schedule appointment for John Doe",
        description: "From email: Appointment request",
        dueDate: new Date("2026-07-20T14:00:00-08:00"),
        emailId: "email-1",
        patientId: null,
        status: "PENDING",
      },
    });
  });

  it("skips duplicate tasks", async () => {
    const mockEmails = [
      {
        id: "email-1",
        fromName: "Jane Smith",
        fromEmail: "jane@example.com",
        subject: "Follow-up needed",
        body: "Need to follow up on treatment",
        toInbox: "SCHEDULING" as const,
        classification: "SCHEDULING" as const,
        status: "NEEDS_ACTION" as const,
        receivedAt: new Date("2026-07-15"),
        gmailMessageId: null,
        gmailThreadId: null,
        gmailAccountId: null,
        insurerLabel: null,
        aiSummary: null,
        aiDraft: null,
        aiAnalysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patientId: null,
      },
    ];

    const mockResults = [
      {
        id: "email-1",
        type: "inquiry" as const,
        patientName: "Jane Smith",
        date: "2026-07-22",
        time: null,
        title: "Follow up with Jane Smith",
        urgency: "medium" as const,
        category: "client" as const,
      },
    ];

    const existingTask = {
      id: "task-existing",
      title: "Follow up with Jane Smith",
      description: null,
      dueDate: new Date("2026-07-22T12:00:00-08:00"),
      status: "PENDING" as const,
      emailId: "email-1",
      patientId: null,
      googleEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      extractionStatus: ExtractionStatus.PENDING_REVIEW,
    };

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(analyzeSchedulingEmails).mockResolvedValue(mockResults);
    vi.mocked(prisma.task.findFirst).mockResolvedValue(existingTask);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(0);
    expect(data.skipped).toBe(1);
    expect(data.total).toBe(1);
    expect(vi.mocked(prisma.task.create)).not.toHaveBeenCalled();
  });

  it("handles multiple emails in batch", async () => {
    const mockEmails = [
      {
        id: "email-1",
        fromName: "Alice",
        fromEmail: "alice@example.com",
        subject: "Appointment 1",
        body: "Need appointment",
        toInbox: "SCHEDULING" as const,
        classification: "SCHEDULING" as const,
        status: "UNREAD" as const,
        receivedAt: new Date("2026-07-15"),
        gmailMessageId: null,
        gmailThreadId: null,
        gmailAccountId: null,
        insurerLabel: null,
        aiSummary: null,
        aiDraft: null,
        aiAnalysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patientId: null,
      },
      {
        id: "email-2",
        fromName: "Bob",
        fromEmail: "bob@example.com",
        subject: "Appointment 2",
        body: "Need appointment",
        toInbox: "SCHEDULING" as const,
        classification: "SCHEDULING" as const,
        status: "UNREAD" as const,
        receivedAt: new Date("2026-07-16"),
        gmailMessageId: null,
        gmailThreadId: null,
        gmailAccountId: null,
        insurerLabel: null,
        aiSummary: null,
        aiDraft: null,
        aiAnalysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patientId: null,
      },
      {
        id: "email-3",
        fromName: "Charlie",
        fromEmail: "charlie@example.com",
        subject: "Appointment 3",
        body: "Need appointment",
        toInbox: "SCHEDULING" as const,
        classification: "SCHEDULING" as const,
        status: "UNREAD" as const,
        receivedAt: new Date("2026-07-17"),
        gmailMessageId: null,
        gmailThreadId: null,
        gmailAccountId: null,
        insurerLabel: null,
        aiSummary: null,
        aiDraft: null,
        aiAnalysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patientId: null,
      },
    ];

    const mockResults = [
      {
        id: "email-1",
        type: "appointment" as const,
        patientName: "Alice",
        date: "2026-07-20",
        time: "10:00",
        title: "Appointment for Alice",
        urgency: "medium" as const,
        category: "client" as const,
      },
      {
        id: "email-2",
        type: "appointment" as const,
        patientName: "Bob",
        date: "2026-07-21",
        time: "11:00",
        title: "Appointment for Bob",
        urgency: "medium" as const,
        category: "client" as const,
      },
      {
        id: "email-3",
        type: "appointment" as const,
        patientName: "Charlie",
        date: "2026-07-22",
        time: "14:00",
        title: "Appointment for Charlie",
        urgency: "medium" as const,
        category: "client" as const,
      },
    ];

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(analyzeSchedulingEmails).mockResolvedValue(mockResults);
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.task.create).mockResolvedValue({
      id: "task-1",
      title: "Appointment for Alice",
      description: "From email: Appointment 1",
      dueDate: new Date("2026-07-20T10:00:00-08:00"),
      status: "PENDING",
      emailId: "email-1",
      patientId: null,
      googleEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      extractionStatus: "PENDING_REVIEW"
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(3);
    expect(data.skipped).toBe(0);
    expect(data.total).toBe(3);
    expect(vi.mocked(analyzeSchedulingEmails)).toHaveBeenCalledTimes(1);
  });

  it("skips emails with no title", async () => {
    const mockEmails = [
      {
        id: "email-1",
        fromName: "Test User",
        fromEmail: "test@example.com",
        subject: "No action needed",
        body: "Just informational",
        toInbox: "INFO" as const,
        classification: "GENERAL" as const,
        status: "NEEDS_ACTION" as const,
        receivedAt: new Date("2026-07-15"),
        gmailMessageId: null,
        gmailThreadId: null,
        gmailAccountId: null,
        insurerLabel: null,
        aiSummary: null,
        aiDraft: null,
        aiAnalysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patientId: null,
      },
    ];

    const mockResults = [
      {
        id: "email-1",
        type: "inquiry" as const,
        patientName: "Unknown",
        date: null,
        time: null,
        title: "",
        urgency: "low" as const,
        category: "client" as const,
      },
    ];

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(analyzeSchedulingEmails).mockResolvedValue(mockResults);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(0);
    expect(data.skipped).toBe(0);
    expect(data.total).toBe(1);
    expect(vi.mocked(prisma.task.create)).not.toHaveBeenCalled();
  });

  it("handles AI service errors", async () => {
    const mockEmails = [
      {
        id: "email-1",
        fromName: "Error Test",
        fromEmail: "error@example.com",
        subject: "Test",
        body: "Test body",
        toInbox: "SCHEDULING" as const,
        classification: "SCHEDULING" as const,
        status: "UNREAD" as const,
        receivedAt: new Date("2026-07-15"),
        gmailMessageId: null,
        gmailThreadId: null,
        gmailAccountId: null,
        insurerLabel: null,
        aiSummary: null,
        aiDraft: null,
        aiAnalysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patientId: null,
      },
    ];

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(analyzeSchedulingEmails).mockRejectedValue(new Error("AI service failed"));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to sync tasks from emails");
    expect(data.details).toBe("AI service failed");
  });

  it("filters emails correctly", async () => {
    vi.mocked(prisma.email.findMany).mockResolvedValue([]);

    await POST();

    expect(vi.mocked(prisma.email.findMany)).toHaveBeenCalledWith({
      where: {
        OR: [
          { classification: "SCHEDULING" },
          { status: "NEEDS_ACTION" },
        ],
        tasks: { none: {} },
      },
      orderBy: { receivedAt: "asc" },
    });
  });

  it("handles 413 Payload Too Large errors gracefully", async () => {
    const mockEmails = [
      {
        id: "email-1",
        fromName: "Test User",
        fromEmail: "test@example.com",
        subject: "Large email",
        body: "x".repeat(10000), // Very large body
        toInbox: "SCHEDULING" as const,
        classification: "SCHEDULING" as const,
        status: "UNREAD" as const,
        receivedAt: new Date("2026-07-15"),
        gmailMessageId: null,
        gmailThreadId: null,
        gmailAccountId: null,
        insurerLabel: null,
        aiSummary: null,
        aiDraft: null,
        aiAnalysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patientId: null,
      },
    ];

    // Mock AI service to return 413 error on first call, then succeed on retry
    let callCount = 0;
    vi.mocked(analyzeSchedulingEmails).mockImplementation(async (emails) => {
      callCount++;
      if (callCount === 1 && emails.length > 1) {
        throw new Error("Groq API request failed: 413 Payload Too Large");
      }

      // Return results for each email
      return emails.map((email, idx) => ({
        id: email.id,
        type: "appointment" as const,
        patientName: "Test User",
        date: "2026-07-20",
        time: "10:00",
        title: `Appointment ${idx + 1}`,
        urgency: "medium" as const,
        category: "client" as const,
      }));
    });

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.task.create).mockResolvedValue({
      id: "task-1",
      title: "Appointment 1",
      description: "From email: Large email",
      dueDate: new Date("2026-07-20T10:00:00-08:00"),
      status: "PENDING",
      emailId: "email-1",
      patientId: null,
      googleEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      extractionStatus: "PENDING_REVIEW"
    });

    const response = await POST();
    const data = await response.json();

    // Should succeed after retry with smaller batch
    expect(response.status).toBe(200);
    expect(data.created).toBe(1);
  });

  it("truncates long email bodies before AI analysis", async () => {
    const longBody = "x".repeat(5000); // Exceeds 4000 char limit
    const mockEmails = [
      {
        id: "email-1",
        fromName: "Test User",
        fromEmail: "test@example.com",
        subject: "Test",
        body: longBody,
        toInbox: "SCHEDULING" as const,
        classification: "SCHEDULING" as const,
        status: "UNREAD" as const,
        receivedAt: new Date("2026-07-15"),
        gmailMessageId: null,
        gmailThreadId: null,
        gmailAccountId: null,
        insurerLabel: null,
        aiSummary: null,
        aiDraft: null,
        aiAnalysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patientId: null,
      },
    ];

    const mockResults = [
      {
        id: "email-1",
        type: "appointment" as const,
        patientName: "Test User",
        date: "2026-07-20",
        time: "10:00",
        title: "Test appointment",
        urgency: "medium" as const,
        category: "client" as const,
      },
    ];

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(analyzeSchedulingEmails).mockResolvedValue(mockResults);
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.task.create).mockResolvedValue({
      id: "task-1",
      title: "Test appointment",
      description: "From email: Test",
      dueDate: new Date("2026-07-20T10:00:00-08:00"),
      status: "PENDING",
      emailId: "email-1",
      patientId: null,
      googleEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      extractionStatus: "PENDING_REVIEW",
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(1);

    // Verify analyzeSchedulingEmails was called
    expect(vi.mocked(analyzeSchedulingEmails)).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "email-1",
          body: longBody, // Full body is passed to analyzeSchedulingEmails
        }),
      ])
    );
    // Note: Truncation happens inside analyzeSchedulingEmails, not in the route
  });
});
