import type { ClinicDataSource } from "./ClinicDataSource";
import { MockDataSource } from "./MockDataSource";
import { PracticeQDataSource } from "./PracticeQDataSource";

/**
 * Get the clinic data source instance.
 *
 * Environment-based selection:
 * - CLINIC_DATA_SOURCE=practiceq → PracticeQDataSource (REST API, production)
 * - CLINIC_DATA_SOURCE=mock (default) → MockDataSource (Prisma, local dev)
 *
 * @returns ClinicDataSource implementation
 */
export function getDataSource(): ClinicDataSource {
  const source = process.env.CLINIC_DATA_SOURCE ?? "mock";

  switch (source) {
    case "practiceq":
      return new PracticeQDataSource();
    case "mock":
    default:
      return new MockDataSource();
  }
}

export type {
  ClinicDataSource,
  PatientCreateInput,
  PatientUpdateInput,
  EmailListFilters,
  EmailListItem,
  EmailDetail,
} from "./ClinicDataSource";
