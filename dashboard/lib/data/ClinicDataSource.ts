import type {
  Patient,
  Email,
  Task,
  Reminder,
  EmailStatus,
  TaskStatus,
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
  copayCents?: number | null;
  deductibleCents?: number | null;
  deductibleMetCents?: number | null;
  paymentStatus?: string | null;
  outstandingBalanceCents?: number | null;
  lastPaymentDate?: Date | null;
  paymentMethod?: string | null;
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
 * Task creation input including optional nested reminders.
 */
export type TaskCreateInput = {
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  emailId?: string | null;
  patientId?: string | null;
  reminders?: { remindAt: Date }[];
};

/**
 * Task update input including optional reminder replacement.
 */
export type TaskUpdateInput = {
  title?: string;
  description?: string | null;
  dueDate?: Date | null;
  reminders?: { remindAt: Date }[];
};

/**
 * Task detail with relations (patient, email, reminders).
 */
export type TaskWithRelations = Task & {
  patient: Patient | null;
  email: (Email & { gmailMessageId: string | null; gmailThreadId: string | null }) | null;
  reminders: Reminder[];
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
      | "copayCents"
      | "deductibleCents"
      | "deductibleMetCents"
      | "paymentStatus"
      | "outstandingBalanceCents"
      | "lastPaymentDate"
      | "paymentMethod"
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

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  /**
   * List all tasks with relations (patient, email, reminders).
   *
   * @returns Array of tasks ordered by dueDate ascending
   */
  listTasks(): Promise<TaskWithRelations[]>;

  /**
   * Get a single task by ID.
   *
   * @param id - Task ID
   * @returns Task with relations or null if not found
   */
  getTask(id: string): Promise<TaskWithRelations | null>;

  /**
   * Find an existing task by email ID and title (for deduplication).
   *
   * @param emailId - Email ID (nullable)
   * @param title - Task title
   * @returns Task with relations or null if not found
   */
  findTaskByEmailAndTitle(
    emailId: string | null,
    title: string,
  ): Promise<TaskWithRelations | null>;

  /**
   * Create a new task with optional nested reminders.
   *
   * @param input - Task creation input
   * @returns Created task with relations
   */
  createTask(input: TaskCreateInput): Promise<TaskWithRelations>;

  /**
   * Update an existing task, replacing reminders if provided.
   *
   * If reminders array is provided, all existing reminders are deleted
   * and replaced with the new set.
   *
   * @param id - Task ID
   * @param input - Partial task update input
   * @returns Updated task with relations
   */
  updateTask(id: string, input: TaskUpdateInput): Promise<TaskWithRelations>;

  /**
   * Delete a task by ID.
   *
   * Reminders are cascade-deleted.
   *
   * @param id - Task ID
   * @returns void
   */
  deleteTask(id: string): Promise<void>;

  /**
   * Set task status (PENDING, COMPLETE, or ARCHIVED).
   *
   * @param id - Task ID
   * @param status - New status
   * @returns Updated task record
   */
  setTaskStatus(id: string, status: TaskStatus): Promise<Task>;
}
