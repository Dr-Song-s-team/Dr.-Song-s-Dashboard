/**
 * PracticeQ REST API data source (stub implementation).
 *
 * Rate limits:
 * - 10 requests per minute
 * - 500 requests per day
 *
 * Status: NOT IMPLEMENTED
 * Pending:
 * - PracticeQ API access credentials
 * - Business Associate Agreement (BAA) execution
 * - API documentation and endpoint mapping
 *
 * When implemented, this will replace MockDataSource in production
 * to source clinic data from the PracticeQ EHR system via REST API.
 */

import type { Patient, Email, EmailStatus } from "@/app/generated/prisma/client";
import type {
  ClinicDataSource,
  PatientCreateInput,
  PatientUpdateInput,
  EmailListFilters,
  EmailListItem,
  EmailDetail,
} from "./ClinicDataSource";

const NOT_IMPLEMENTED = "PracticeQDataSource not implemented — pending API access + BAA";

export class PracticeQDataSource implements ClinicDataSource {
  // ---------------------------------------------------------------------------
  // Patients
  // ---------------------------------------------------------------------------

  async listPatients(): Promise<
    Pick<
      Patient,
      | "id"
      | "firstName"
      | "lastName"
      | "dob"
      | "phone"
      | "email"
      | "insurer"
      | "memberId"
      | "authLimit"
      | "visitsUsed"
      | "statusNotes"
      | "copayCents"
      | "deductibleCents"
      | "deductibleMetCents"
      | "paymentStatus"
      | "outstandingBalanceCents"
      | "lastPaymentDate"
      | "paymentMethod"
    >[]
  > {
    throw new Error(NOT_IMPLEMENTED);
  }

  async getPatient(_id: string): Promise<Patient | null> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async createPatient(_data: PatientCreateInput): Promise<Patient> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async updatePatient(_id: string, _data: PatientUpdateInput): Promise<Patient> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // ---------------------------------------------------------------------------
  // Emails
  // ---------------------------------------------------------------------------

  async listEmails(_filters?: EmailListFilters): Promise<EmailListItem[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async getEmail(_id: string): Promise<EmailDetail | null> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async updateEmailStatus(
    _id: string,
    _status: EmailStatus,
  ): Promise<Pick<Email, "id" | "status">> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listInsurerLabels(): Promise<string[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
