import { prisma } from "@/lib/prisma";
import type { Prisma, EmailStatus } from "@/app/generated/prisma/client";
import type {
  ClinicDataSource,
  PatientCreateInput,
  PatientUpdateInput,
  EmailListFilters,
  EmailListItem,
  EmailDetail,
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
        copayCents: true,
        deductibleCents: true,
        deductibleMetCents: true,
        paymentStatus: true,
        outstandingBalanceCents: true,
        lastPaymentDate: true,
        paymentMethod: true,
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
    const { insurer, status, client, subject, from, to } = filters ?? {};

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

    if (subject) {
      where.subject = { contains: subject, mode: "insensitive" };
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
