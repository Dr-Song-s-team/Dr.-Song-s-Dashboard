import type {
  Patient,
  Email,
  EmailStatus,
} from "@/app/generated/prisma/client";

/**
 * Patient data for creation (omits id, createdAt, updatedAt).
 */
export type PatientCreateInput = {
  firstName: string;
  lastName: string;
  dob: Date;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  insurer: string;
  memberId: string;
  authLimit: number;
  visitsUsed?: number;
  statusNotes?: string | null;
};

/**
 * Patient data for updates (partial).
 */
export type PatientUpdateInput = Partial<PatientCreateInput>;

/**
 * Filters for email list queries.
 */
export type EmailListFilters = {
  insurer?: string;
  status?: EmailStatus;
  client?: string;
  from?: string; // ISO date string YYYY-MM-DD
  to?: string; // ISO date string YYYY-MM-DD
};

/**
 * Email list item with optional patient insurer relation.
 */
export type EmailListItem = Email & {
  patient?: { insurer: string } | null;
};

/**
 * Email detail with optional patient insurer relation.
 */
export type EmailDetail = Email & {
  patient?: { insurer: string } | null;
};

/**
 * Data source abstraction for clinic operations.
 *
 * Implementations:
 * - MockDataSource: delegates to Prisma (local dev, current production)
 * - PracticeQDataSource: REST API calls to PracticeQ (future, pending BAA)
 */
export interface ClinicDataSource {
  // ---------------------------------------------------------------------------
  // Patients
  // ---------------------------------------------------------------------------

  /**
   * List all patients, ordered by last name, first name.
   *
   * @returns Array of patients with selected fields for list view
   */
  listPatients(): Promise<
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
    >[]
  >;

  /**
   * Get a single patient by ID.
   *
   * @param id - Patient ID
   * @returns Patient record or null if not found
   */
  getPatient(id: string): Promise<Patient | null>;

  /**
   * Create a new patient.
   *
   * @param data - Patient creation data
   * @returns Created patient record
   * @throws Error if email is not unique (Prisma P2002)
   */
  createPatient(data: PatientCreateInput): Promise<Patient>;

  /**
   * Update an existing patient.
   *
   * @param id - Patient ID
   * @param data - Partial patient update data
   * @returns Updated patient record
   * @throws Error if patient not found or email is not unique
   */
  updatePatient(id: string, data: PatientUpdateInput): Promise<Patient>;

  // ---------------------------------------------------------------------------
  // Emails
  // ---------------------------------------------------------------------------

  /**
   * List emails with optional filtering.
   *
   * Supports filtering by:
   * - insurer (via insurerLabel or patient.insurer fallback)
   * - status (UNREAD, READ, NEEDS_ACTION, ARCHIVED)
   * - client (matches fromName or patient first/last name)
   * - from/to date range (receivedAt)
   *
   * @param filters - Optional filter criteria
   * @returns Array of emails ordered by receivedAt descending
   */
  listEmails(filters?: EmailListFilters): Promise<EmailListItem[]>;

  /**
   * Get a single email by ID.
   *
   * @param id - Email ID
   * @returns Email record with patient relation or null if not found
   */
  getEmail(id: string): Promise<EmailDetail | null>;

  /**
   * Update email status (READ or NEEDS_ACTION).
   *
   * @param id - Email ID
   * @param status - New status
   * @returns Updated email record (id + status only)
   */
  updateEmailStatus(
    id: string,
    status: EmailStatus,
  ): Promise<Pick<Email, "id" | "status">>;

  /**
   * List distinct insurer labels for filter dropdown.
   *
   * Falls back to patient.insurer if insurerLabel column does not exist.
   *
   * @returns Array of unique insurer strings, sorted alphabetically
   */
  listInsurerLabels(): Promise<string[]>;
}
