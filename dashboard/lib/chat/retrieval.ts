/**
 * Pure Prisma retrieval functions for the AI admin chatbot.
 * No AI calls here - just database queries and context building.
 */

import { prisma } from "@/lib/prisma";
import type { Email, Patient, Document } from "@/app/generated/prisma/client";

const MAX_CONTEXT_CHARS = 6000;

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

/**
 * Build a plain-text context block from retrieved data.
 * Sections: === EMAILS ===, === PATIENTS ===, === DOCUMENTS ===
 * Each record is compact (a few lines).
 * Cap total at ~6000 chars, truncating oldest first.
 */
export function buildContext(
  emails: Email[],
  patients: Array<
    Patient & {
      emails: Email[];
      documents: Document[];
    }
  >,
  documents: Document[]
): string {
  const sections: string[] = [];

  // === EMAILS ===
  if (emails.length > 0) {
    const emailLines = emails.map((e) => {
      const summary = e.aiSummary ? ` | Summary: ${e.aiSummary}` : "";
      return `- [${e.receivedAt.toISOString().split("T")[0]}] From: ${e.fromName} <${e.fromEmail}> | Subject: ${e.subject}${summary}`;
    });
    sections.push(`=== EMAILS ===\n${emailLines.join("\n")}`);
  }

  // === PATIENTS ===
  if (patients.length > 0) {
    const patientBlocks = patients.map((p) => {
      const lines: string[] = [];
      lines.push(
        `- ${p.firstName} ${p.lastName} | DOB: ${p.dob.toISOString().split("T")[0]} | Insurer: ${p.insurer} | Auth: ${p.visitsUsed}/${p.authLimit}`
      );
      if (p.statusNotes) {
        lines.push(`  Status: ${p.statusNotes}`);
      }
      if (p.emails.length > 0) {
        lines.push(
          `  Recent emails: ${p.emails.map((e) => e.subject).join("; ")}`
        );
      }
      if (p.documents.length > 0) {
        lines.push(
          `  Recent docs: ${p.documents.map((d) => d.title).join("; ")}`
        );
      }
      return lines.join("\n");
    });
    sections.push(`=== PATIENTS ===\n${patientBlocks.join("\n")}`);
  }

  // === DOCUMENTS ===
  if (documents.length > 0) {
    const docLines = documents.map((d) => {
      const notes = d.notes ? ` | Notes: ${d.notes}` : "";
      const preview = d.content
        ? ` | Content preview: ${d.content.slice(0, 100)}...`
        : "";
      return `- ${d.title} (${d.type})${notes}${preview}`;
    });
    sections.push(`=== DOCUMENTS ===\n${docLines.join("\n")}`);
  }

  const fullContext = sections.join("\n\n");

  // Truncate if too long (oldest first means we truncate from the end)
  if (fullContext.length > MAX_CONTEXT_CHARS) {
    return fullContext.slice(0, MAX_CONTEXT_CHARS) + "\n...(truncated)";
  }

  return fullContext;
}
