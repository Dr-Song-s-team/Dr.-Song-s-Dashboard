/**
 * Pure Prisma retrieval functions for the AI admin chatbot.
 * No AI calls here - just database queries and context building.
 */

import { prisma } from "@/lib/prisma";
import type { Email, Patient, Document } from "@/app/generated/prisma/client";

export { buildContext } from "./context";

/**
 * Count keyword matches in an email for relevance scoring.
 */
function scoreEmailRelevance(email: Email, terms: string[]): number {
  if (terms.length === 0) return 0;

  const searchableText = [
    email.subject,
    email.body,
    email.fromName,
    email.aiSummary || "",
  ].join(" ").toLowerCase();

  let score = 0;
  for (const term of terms) {
    const termLower = term.toLowerCase();
    // Count occurrences of this term
    const regex = new RegExp(termLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = searchableText.match(regex);
    if (matches) {
      score += matches.length;
      // Bonus for subject line matches (more relevant)
      if (email.subject.toLowerCase().includes(termLower)) {
        score += 2;
      }
    }
  }
  return score;
}

/**
 * Search emails by OR-contains over subject/body/fromName/aiSummary.
 * Case-insensitive, returns up to `limit` emails ranked by relevance (keyword matches), then recency.
 *
 * @param terms - Search terms to match
 * @param limit - Maximum number of emails to return (default: 20)
 */
export async function searchEmails(terms: string[], limit: number = 20): Promise<Email[]> {
  if (terms.length === 0) return [];

  const conditions = terms.flatMap((term) => [
    { subject: { contains: term, mode: "insensitive" as const } },
    { body: { contains: term, mode: "insensitive" as const } },
    { fromName: { contains: term, mode: "insensitive" as const } },
    { aiSummary: { contains: term, mode: "insensitive" as const } },
  ]);

  // Fetch more than limit to allow for relevance ranking
  const emails = await prisma.email.findMany({
    where: { OR: conditions },
    orderBy: { receivedAt: "desc" },
    take: Math.max(limit, 50), // Fetch extra to rank by relevance
  });

  // Score and sort by relevance
  const scored = emails.map((email) => ({
    email,
    score: scoreEmailRelevance(email, terms),
  }));

  // Sort by score (descending), then by recency (descending)
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.email.receivedAt.getTime() - a.email.receivedAt.getTime();
  });

  return scored.slice(0, limit).map((s) => s.email);
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
