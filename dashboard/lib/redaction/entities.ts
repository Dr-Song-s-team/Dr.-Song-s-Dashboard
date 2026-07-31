/**
 * Entity data loading from the database.
 *
 * This module provides the loadEntities() helper that queries the database
 * for entity data used in entity-based detection.
 */

import { prisma } from "@/lib/prisma";
import type { EntityData } from "./types";

/**
 * Load entity data from the database for use in redaction.
 *
 * This function queries all patients and extracts:
 * - First names
 * - Last names
 * - Full names (firstName + lastName)
 * - Member IDs
 *
 * Callers should run this once and pass the result to redact().
 * The redact() function itself never touches the database.
 *
 * @returns EntityData containing all entity information for detection
 */
export async function loadEntities(): Promise<EntityData> {
  // Query all patients with only the fields we need
  const patients = await prisma.patient.findMany({
    select: {
      firstName: true,
      lastName: true,
      memberId: true,
    },
  });

  const patientFirstNames: string[] = [];
  const patientLastNames: string[] = [];
  const patientFullNames: string[] = [];
  const memberIds: string[] = [];

  for (const patient of patients) {
    // Collect first names
    if (patient.firstName) {
      patientFirstNames.push(patient.firstName);
    }

    // Collect last names
    if (patient.lastName) {
      patientLastNames.push(patient.lastName);
    }

    // Collect full names
    if (patient.firstName && patient.lastName) {
      patientFullNames.push(`${patient.firstName} ${patient.lastName}`);
    }

    // Collect member IDs
    if (patient.memberId) {
      memberIds.push(patient.memberId);
    }
  }

  return {
    patientFirstNames,
    patientLastNames,
    patientFullNames,
    memberIds,
  };
}
