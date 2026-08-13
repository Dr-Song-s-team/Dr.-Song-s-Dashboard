/**
 * Pure Prisma retrieval functions for the AI admin chatbot.
 * No AI calls here - just database queries and context building.
 */

import { prisma } from "@/lib/prisma";
import type { Email, Patient, Document } from "@/app/generated/prisma/client";

export { buildContext } from "./context";

/**
 * Search emails by OR-contains over subject/body/fromName/aiSummary.
 * Case-insensitive, returns up to 5 newest first.
 */
export async function searchEmails(terms: string[]): Promise<Email[]> {
  if (terms.length === 0) return [];

  const conditions = terms.flatMap((term) => [
    { subject: { contains: term, mode: "insensitive" as const } },
    { body: { contains: term, mode: "insensitive" as const } },
    { fromName: { contains: term, mode: "insensitive" as const } },
    { aiSummary: { contains: term, mode: "insensitive" as const } },
  ]);

  return prisma.email.findMany({
    where: { OR: conditions },
    orderBy: { receivedAt: "desc" },
    take: 5,
  });
}

/**
 * Search patients by firstName/lastName/insurer/statusNotes.
 * Returns up to 3, each with latest 3 emails + 3 documents.
 */
export async function searchPatients(
  terms: string[]
): Promise<
  Array<
    Patient & {
      emails: Email[];
      documents: Document[];
    }
  >
> {
  if (terms.length === 0) return [];

  const conditions = terms.flatMap((term) => [
    { firstName: { contains: term, mode: "insensitive" as const } },
    { lastName: { contains: term, mode: "insensitive" as const } },
    { insurer: { contains: term, mode: "insensitive" as const } },
    { statusNotes: { contains: term, mode: "insensitive" as const } },
  ]);

  return prisma.patient.findMany({
    where: { OR: conditions },
    take: 3,
    include: {
      emails: {
        orderBy: { receivedAt: "desc" },
        take: 3,
      },
      documents: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });
}

/**
 * Search documents by title/notes/content.
 * Returns up to 3 newest first.
 */
export async function searchDocuments(terms: string[]): Promise<Document[]> {
  if (terms.length === 0) return [];

  const conditions = terms.flatMap((term) => [
    { title: { contains: term, mode: "insensitive" as const } },
    { notes: { contains: term, mode: "insensitive" as const } },
    { content: { contains: term, mode: "insensitive" as const } },
  ]);

  return prisma.document.findMany({
    where: { OR: conditions },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
}
