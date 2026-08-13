import { prisma } from "@/lib/prisma";
import type { ClinicInbox } from "@/app/generated/prisma/client";

/**
 * Ensures an email exists in the database by Gmail message ID.
 * Creates a new email record if it doesn't exist, otherwise returns the existing one.
 *
 * @param email - Email object from Gmail API
 * @returns The Prisma email record
 */
export async function ensureEmailExists(email: {
  id: string;
  threadId?: string | null;
  gmailThreadId?: string | null;
  gmailAccountId?: string | null;
  toInbox?: ClinicInbox | string;
  sender?: string;
  senderName?: string;
  fromName?: string;
  senderEmail?: string;
  fromEmail?: string;
  subject?: string;
  body?: string;
  receivedAt?: string | Date;
  patientId?: string | null;
}) {
  const gmailMessageId = email.id;

  if (!gmailMessageId) {
    throw new Error("Cannot import email without Gmail message ID");
  }

  const existing = await prisma.email.findUnique({
    where: {
      gmailMessageId,
    },
  });

  if (existing) {
    return existing;
  }

  const sender = email.sender ?? email.fromEmail ?? "";

  const senderName = email.senderName ?? email.fromName ?? sender;

  const senderEmail = email.senderEmail ?? email.fromEmail ?? sender;

  const created = await prisma.email.create({
    data: {
      gmailMessageId,

      gmailThreadId: email.threadId ?? email.gmailThreadId ?? null,

      gmailAccountId: email.gmailAccountId ?? null,

      toInbox: (email.toInbox as ClinicInbox) ?? "INFO",

      fromName: senderName,

      fromEmail: senderEmail,

      subject: email.subject ?? "",

      body: email.body ?? "",

      receivedAt: email.receivedAt ? new Date(email.receivedAt) : new Date(),

      patientId: email.patientId ?? null,
    },
  });

  return created;
}
