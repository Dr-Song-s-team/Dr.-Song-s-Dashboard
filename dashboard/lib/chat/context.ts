/**
 * Pure context building functions for chat retrieval.
 * Zero dependencies on Prisma or environment — just formatting logic.
 */

import type { Email, Patient, Document } from "@/app/generated/prisma/client";

const MAX_CONTEXT_CHARS = 6000;

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
