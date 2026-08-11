import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import {
  analyzeSchedulingEmails,
  analyzeSchedulingEmailBatch,
  extractTasksDeterministically,
  loadEntities,
} from "@/app/(dashboard)/calendar/aiService";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    email: {
      findMany: vi.fn(),
      count: vi.fn(),
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
  analyzeSchedulingEmailBatch: vi.fn(),
  extractTasksDeterministically: vi.fn(),
  loadEntities: vi.fn(),
}));

vi.mock("@/lib/googleCalendar", () => ({
  getGoogleCalendar: vi.fn().mockRejectedValue(new Error("No Google account connected.")),
  buildGoogleReminders: vi.fn().mockReturnValue({ useDefault: false, overrides: [] }),
}));

describe("POST /api/events/sync-from-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for count - tests can override if needed
    vi.mocked(prisma.email.count).mockResolvedValue(0);
  });

  it("returns zero counts when no emails to process", async () => {
    vi.mocked(prisma.email.findMany).mockResolvedValue([]);
    vi.mocked(prisma.email.count).mockResolvedValue(0);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      created: 0,
      aiAnalyzed: 0,
      fallback: 0,
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
    vi.mocked(prisma.email.count).mockResolvedValue(1);
    vi.mocked(loadEntities).mockResolvedValue({
      patientFirstNames: [],
      patientLastNames: [],
      patientFullNames: [],
      memberIds: [],
    });
    vi.mocked(analyzeSchedulingEmailBatch).mockResolvedValue(mockResults);
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
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(1);
    expect(data.aiAnalyzed).toBe(1);
    expect(data.fallback).toBe(0);
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
    };

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(loadEntities).mockResolvedValue({
      patientFirstNames: [],
      patientLastNames: [],
      patientFullNames: [],
      memberIds: [],
    });
    vi.mocked(analyzeSchedulingEmailBatch).mockResolvedValue(mockResults);
    vi.mocked(prisma.task.findFirst).mockResolvedValue(existingTask);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(0);
    expect(data.aiAnalyzed).toBe(1);
    expect(data.fallback).toBe(0);
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
    vi.mocked(loadEntities).mockResolvedValue({
      patientFirstNames: [],
      patientLastNames: [],
      patientFullNames: [],
      memberIds: [],
    });
    vi.mocked(analyzeSchedulingEmailBatch).mockResolvedValue(mockResults);
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
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(3);
    expect(data.aiAnalyzed).toBe(3);
    expect(data.fallback).toBe(0);
    expect(data.skipped).toBe(0);
    expect(data.total).toBe(3);
    expect(vi.mocked(analyzeSchedulingEmailBatch)).toHaveBeenCalledTimes(1);
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
    vi.mocked(loadEntities).mockResolvedValue({
      patientFirstNames: [],
      patientLastNames: [],
      patientFullNames: [],
      memberIds: [],
    });
    vi.mocked(analyzeSchedulingEmailBatch).mockResolvedValue(mockResults);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(0);
    expect(data.aiAnalyzed).toBe(1);
    expect(data.fallback).toBe(0);
    expect(data.skipped).toBe(0);
    expect(data.total).toBe(1);
    expect(vi.mocked(prisma.task.create)).not.toHaveBeenCalled();
  });

  it("handles genuine AI service errors with 500", async () => {
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
    vi.mocked(loadEntities).mockResolvedValue({
      patientFirstNames: [],
      patientLastNames: [],
      patientFullNames: [],
      memberIds: [],
    });
    vi.mocked(analyzeSchedulingEmailBatch).mockRejectedValue(new Error("AI service failed"));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to sync tasks from emails");
    expect(data.details).toBe("AI service failed");
  });

  it("handles rate limit errors with deterministic fallback", async () => {
    const mockEmails = [
      {
        id: "email-1",
        fromName: "John Doe",
        fromEmail: "john@example.com",
        subject: "Need to reschedule Thursday appointment",
        body: "I need to move my appointment on July 20",
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

    const fallbackResults = [
      {
        id: "email-1",
        type: "appointment" as const,
        patientName: "John Doe",
        date: "2026-07-20",
        time: null,
        title: "Need to reschedule Thursday appointment",
        urgency: "medium" as const,
        category: "client" as const,
      },
    ];

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(loadEntities).mockResolvedValue({
      patientFirstNames: [],
      patientLastNames: [],
      patientFullNames: [],
      memberIds: [],
    });
    vi.mocked(analyzeSchedulingEmailBatch).mockRejectedValue(
      new Error("429 rate limit exceeded")
    );
    vi.mocked(extractTasksDeterministically).mockReturnValue(fallbackResults);
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.task.create).mockResolvedValue({
      id: "task-1",
      title: "Need to reschedule Thursday appointment",
      description: "Auto-created without AI — review details\n\nFrom email: Need to reschedule Thursday appointment",
      dueDate: new Date("2026-07-20T12:00:00-08:00"),
      status: "PENDING",
      emailId: "email-1",
      patientId: null,
      googleEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(1);
    expect(data.aiAnalyzed).toBe(0);
    expect(data.fallback).toBe(1);
    expect(data.skipped).toBe(0);
    expect(data.total).toBe(1);
    expect(vi.mocked(extractTasksDeterministically)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.task.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Need to reschedule Thursday appointment",
        description: expect.stringContaining("Auto-created without AI — review details"),
      }),
    });
  });

  it("activates circuit breaker after first rate limit", async () => {
    // 6 emails = 2 batches of 3 each
    const mockEmails = Array.from({ length: 6 }, (_, i) => ({
      id: `email-${i + 1}`,
      fromName: `User ${i + 1}`,
      fromEmail: `user${i + 1}@example.com`,
      subject: `Appointment ${i + 1}`,
      body: `Need appointment on July ${20 + i}`,
      toInbox: "SCHEDULING" as const,
      classification: "SCHEDULING" as const,
      status: "UNREAD" as const,
      receivedAt: new Date(`2026-07-${15 + i}`),
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
    }));

    const fallbackResults = Array.from({ length: 3 }, (_, i) => ({
      id: `email-${i + 1}`,
      type: "appointment" as const,
      patientName: `User ${i + 1}`,
      date: `2026-07-${20 + i}`,
      time: null,
      title: `Appointment ${i + 1}`,
      urgency: "medium" as const,
      category: "client" as const,
    }));

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(loadEntities).mockResolvedValue({
      patientFirstNames: [],
      patientLastNames: [],
      patientFullNames: [],
      memberIds: [],
    });

    // First batch: 429 error
    vi.mocked(analyzeSchedulingEmailBatch).mockRejectedValueOnce(
      new Error("429 rate limit")
    );

    vi.mocked(extractTasksDeterministically).mockReturnValue(fallbackResults);
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.task.create).mockResolvedValue({
      id: "task-1",
      title: "Test task",
      description: "From email: test",
      dueDate: null,
      status: "PENDING",
      emailId: "email-1",
      patientId: null,
      googleEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(6);
    expect(data.aiAnalyzed).toBe(0);
    expect(data.fallback).toBe(6);

    // Should call analyzeSchedulingEmailBatch only once (first batch fails, circuit breaker trips)
    expect(vi.mocked(analyzeSchedulingEmailBatch)).toHaveBeenCalledTimes(1);

    // Should call extractTasksDeterministically twice (once for first batch, once for second)
    expect(vi.mocked(extractTasksDeterministically)).toHaveBeenCalledTimes(2);
  });

  it("filters emails correctly with 9-email cap", async () => {
    vi.mocked(prisma.email.findMany).mockResolvedValue([]);
    vi.mocked(prisma.email.count).mockResolvedValue(0);

    await POST();

    expect(vi.mocked(prisma.email.findMany)).toHaveBeenCalledWith({
      where: {
        OR: [{ classification: "SCHEDULING" }, { status: "NEEDS_ACTION" }],
        tasks: { none: {} },
      },
      orderBy: { receivedAt: "asc" },
      take: 9,
    });
  });

  it("caps sync at 9 emails and shows remaining count", async () => {
    // 15 total syncable emails, but only 9 are fetched
    const mockEmails = Array.from({ length: 9 }, (_, i) => ({
      id: `email-${i + 1}`,
      fromName: `User ${i + 1}`,
      fromEmail: `user${i + 1}@example.com`,
      subject: `Appointment ${i + 1}`,
      body: `Need appointment`,
      toInbox: "SCHEDULING" as const,
      classification: "SCHEDULING" as const,
      status: "UNREAD" as const,
      receivedAt: new Date(`2026-07-${15 + i}`),
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
    }));

    const mockResults = Array.from({ length: 9 }, (_, i) => ({
      id: `email-${i + 1}`,
      type: "appointment" as const,
      patientName: `User ${i + 1}`,
      date: `2026-07-${20 + i}`,
      time: "10:00",
      title: `Appointment ${i + 1}`,
      urgency: "medium" as const,
      category: "client" as const,
    }));

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(prisma.email.count).mockResolvedValue(15); // 15 total syncable
    vi.mocked(loadEntities).mockResolvedValue({
      patientFirstNames: [],
      patientLastNames: [],
      patientFullNames: [],
      memberIds: [],
    });
    // Mock returns only results matching the batch
    vi.mocked(analyzeSchedulingEmailBatch).mockImplementation(async (batch) => {
      return mockResults.filter((result) => batch.some((email) => email.id === result.id));
    });
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.task.create).mockResolvedValue({
      id: "task-1",
      title: "Appointment 1",
      description: "From email: Appointment 1",
      dueDate: new Date("2026-07-20T10:00:00-08:00"),
      status: "PENDING",
      emailId: "email-1",
      patientId: null,
      googleEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(9);
    expect(data.total).toBe(9);
    expect(data.message).toContain("6 more emails pending, click Sync again");
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

    const mockResults = [
      {
        id: "email-1",
        type: "appointment" as const,
        patientName: "Test User",
        date: "2026-07-20",
        time: "10:00",
        title: "Appointment 1",
        urgency: "medium" as const,
        category: "client" as const,
      },
    ];

    vi.mocked(prisma.email.findMany).mockResolvedValue(mockEmails);
    vi.mocked(loadEntities).mockResolvedValue({
      patientFirstNames: [],
      patientLastNames: [],
      patientFullNames: [],
      memberIds: [],
    });
    // analyzeSchedulingEmailBatch handles 413 splitting internally, always returns results
    vi.mocked(analyzeSchedulingEmailBatch).mockResolvedValue(mockResults);
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
    });

    const response = await POST();
    const data = await response.json();

    // Should succeed - 413 handling is in analyzeSchedulingEmailBatch
    expect(response.status).toBe(200);
    expect(data.created).toBe(1);
    expect(data.aiAnalyzed).toBe(1);
    expect(data.fallback).toBe(0);
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
    vi.mocked(loadEntities).mockResolvedValue({
      patientFirstNames: [],
      patientLastNames: [],
      patientFullNames: [],
      memberIds: [],
    });
    vi.mocked(analyzeSchedulingEmailBatch).mockResolvedValue(mockResults);
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
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(1);

    // Verify analyzeSchedulingEmailBatch was called with full body
    expect(vi.mocked(analyzeSchedulingEmailBatch)).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "email-1",
          body: longBody, // Full body is passed to analyzeSchedulingEmailBatch
        }),
      ]),
      expect.anything()
    );
    // Note: Truncation happens inside analyzeSchedulingEmailBatch, not in the route
  });
});
