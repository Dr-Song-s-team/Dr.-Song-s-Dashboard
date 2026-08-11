import { prisma } from "@/lib/prisma";
import type { Prisma, EmailStatus, TaskStatus } from "@/app/generated/prisma/client";
import type {
  ClinicDataSource,
  PatientCreateInput,
  PatientUpdateInput,
  EmailListFilters,
  EmailListItem,
  EmailDetail,
  TaskCreateInput,
  TaskUpdateInput,
  TaskWithRelations,
} from "./ClinicDataSource";

/**
 * Mock data source implementation backed by Prisma.
 *
 * This is a thin wrapper that translates domain method calls into
 * existing Prisma queries. No new behavior — query logic is copied
 * verbatim from current route handlers.
 *
 * Used for local development and current production (seeded SQLite).
 */
export class MockDataSource implements ClinicDataSource {
  // ---------------------------------------------------------------------------
  // Patients
  // ---------------------------------------------------------------------------

  async listPatients() {
    return prisma.patient.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        phone: true,
        email: true,
        insurer: true,
        memberId: true,
        authLimit: true,
        visitsUsed: true,
        statusNotes: true,
      },
    });
  }

  async getPatient(id: string) {
    return prisma.patient.findUnique({ where: { id } });
  }

  async createPatient(data: PatientCreateInput) {
    return prisma.patient.create({ data });
  }

  async updatePatient(id: string, data: PatientUpdateInput) {
    return prisma.patient.update({ where: { id }, data });
  }

  // ---------------------------------------------------------------------------
  // Emails
  // ---------------------------------------------------------------------------

  async listEmails(filters?: EmailListFilters): Promise<EmailListItem[]> {
    const { insurer, status, client, from, to } = filters ?? {};

    // Build where clause — copied from email/page.tsx:76-117
    const where: Prisma.EmailWhereInput = {};

    if (insurer) {
      // Try insurerLabel first, fallback to patient.insurer handled in catch
      where.insurerLabel = insurer;
    }

    if (status) {
      where.status = status;
    }

    if (client) {
      const clientTerms = client.trim().split(/\s+/).filter(Boolean);
      where.OR = [
        { fromName: { contains: client, mode: "insensitive" } },
        {
          patient: {
            is: {
              AND: clientTerms.map((namePart) => ({
                OR: [
                  { firstName: { contains: namePart, mode: "insensitive" } },
                  { lastName: { contains: namePart, mode: "insensitive" } },
                ],
              })),
            },
          },
        },
      ];
    }

    const validDate = (value?: string) =>
      Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

    if (validDate(from) || validDate(to)) {
      where.receivedAt = {
        ...(validDate(from) ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
        ...(validDate(to) ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
      };
    }

    try {
      return await prisma.email.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          toInbox: true,
          fromName: true,
          fromEmail: true,
          subject: true,
          body: true,
          status: true,
          classification: true,
          insurerLabel: true,
          receivedAt: true,
          patient: { select: { insurer: true } },
        },
      }) as EmailListItem[];
    } catch (error) {
      // Fallback if insurerLabel column missing (Prisma P2022)
      if (this.isMissingInsurerLabelColumn(error)) {
        const fallbackWhere: Prisma.EmailWhereInput = { ...where };
        if (insurer) {
          delete fallbackWhere.insurerLabel;
          fallbackWhere.patient = { is: { insurer } };
        }

        return (await prisma.email.findMany({
          where: fallbackWhere,
          orderBy: { receivedAt: "desc" },
          select: {
            id: true,
            toInbox: true,
            fromName: true,
            fromEmail: true,
            subject: true,
            body: true,
            status: true,
            classification: true,
            receivedAt: true,
            patient: { select: { insurer: true } },
          },
        })) as EmailListItem[];
      }
      throw error;
    }
  }

  async getEmail(id: string): Promise<EmailDetail | null> {
    return (await prisma.email.findUnique({
      where: { id },
      select: {
        id: true,
        toInbox: true,
        fromName: true,
        fromEmail: true,
        subject: true,
        body: true,
        status: true,
        classification: true,
        receivedAt: true,
        aiSummary: true,
        aiDraft: true,
        aiAnalysis: true,
        patient: { select: { insurer: true } },
      },
    })) as EmailDetail | null;
  }

  async updateEmailStatus(id: string, status: EmailStatus) {
    return prisma.email.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
  }

  async listInsurerLabels(): Promise<string[]> {
    try {
      const insurerRows = await prisma.email.findMany({
        where: { insurerLabel: { not: null } },
        distinct: ["insurerLabel"],
        orderBy: { insurerLabel: "asc" },
        select: { insurerLabel: true },
      });

      return insurerRows.flatMap((email) =>
        email.insurerLabel ? [email.insurerLabel] : [],
      );
    } catch (error) {
      // Fallback if insurerLabel column missing
      if (this.isMissingInsurerLabelColumn(error)) {
        const patients = await prisma.patient.findMany({
          distinct: ["insurer"],
          orderBy: { insurer: "asc" },
          select: { insurer: true },
        });
        return patients.map((patient) => patient.insurer);
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  async listTasks(): Promise<TaskWithRelations[]> {
    return (await prisma.task.findMany({
      where: {
        extractionStatus: {
          in: ["ACCEPTED", "EDITED"],
        },
      },
      include: {
        patient: true,
        email: true,
        reminders: true,
      },
      orderBy: {
        dueDate: "asc",
      },
    })) as TaskWithRelations[];
  }

  async getTask(id: string): Promise<TaskWithRelations | null> {
    return (await prisma.task.findUnique({
      where: { id },
      include: {
        reminders: true,
        patient: true,
        email: true,
      },
    })) as TaskWithRelations | null;
  }

  async findTaskByEmailAndTitle(
    emailId: string | null,
    title: string,
  ): Promise<TaskWithRelations | null> {
    return (await prisma.task.findFirst({
      where: {
        emailId: emailId ?? null,
        title,
      },
      include: {
        reminders: true,
        patient: true,
        email: true,
      },
    })) as TaskWithRelations | null;
  }

  async createTask(input: TaskCreateInput): Promise<TaskWithRelations> {
    const { title, description, dueDate, emailId, patientId, reminders } = input;

    return (await prisma.task.create({
      data: {
        title,
        description: description ?? null,
        dueDate: dueDate ?? null,
        emailId: emailId ?? null,
        patientId: patientId ?? null,
        reminders: {
          create: (reminders ?? []).map((r) => ({
            remindAt: r.remindAt,
          })),
        },
      },
      include: {
        reminders: true,
        patient: true,
        email: true,
      },
    })) as TaskWithRelations;
  }

  async updateTask(id: string, input: TaskUpdateInput): Promise<TaskWithRelations> {
    const { title, description, dueDate, reminders } = input;

    return (await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
        ...(reminders !== undefined
          ? {
              reminders: {
                deleteMany: {},
                create: reminders.map((r) => ({
                  remindAt: r.remindAt,
                })),
              },
            }
          : {}),
      },
      include: {
        patient: true,
        email: true,
        reminders: true,
      },
    })) as TaskWithRelations;
  }

  async deleteTask(id: string): Promise<void> {
    await prisma.task.delete({ where: { id } });
  }

  async setTaskStatus(id: string, status: TaskStatus) {
    return prisma.task.update({
      where: { id },
      data: { status },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private isMissingInsurerLabelColumn(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2022"
    );
  }
}
