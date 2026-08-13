/**
 * Pure validation for patient intake/edit form fields.
 * Kept separate from the Server Action so it can be unit-tested without
 * Next.js server-context dependencies.
 */

export const PAYMENT_STATUSES = [
  "current",
  "overdue",
  "payment_plan",
  "insurance_only",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "cash",
  "check",
  "card_on_file",
  "insurance_only",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PatientFields = {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  insurer: string;
  memberId: string;
  authLimit: string;
  statusNotes?: string;
  // Billing profile — stored as dollar strings ("30.00"); converted to cents on save
  copay?: string;
  deductible?: string;
  deductibleMet?: string;
  paymentStatus?: string;
  outstandingBalance?: string;
  lastPaymentDate?: string;
  paymentMethod?: string;
};

export type FieldErrors = Record<string, string[]>;

const REQUIRED: Array<[keyof PatientFields, string]> = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["address", "Address"],
  ["city", "City"],
  ["state", "State"],
  ["zip", "ZIP code"],
  ["insurer", "Insurer"],
  ["memberId", "Member ID"],
  ["authLimit", "Authorization limit"],
  ["dob", "Date of birth"],
];

function validateDollars(
  value: string | undefined,
  label: string,
  errors: FieldErrors,
  key: string,
) {
  const v = (value ?? "").trim();
  if (!v) return;
  const num = parseFloat(v);
  if (isNaN(num) || num < 0) {
    errors[key] = [`${label} must be a non-negative dollar amount (e.g. 30.00).`];
  }
}

export function validatePatient(fields: PatientFields): FieldErrors {
  const errors: FieldErrors = {};

  for (const [key, label] of REQUIRED) {
    const val = (fields[key] ?? "").trim();
    if (!val) {
      errors[key] = [`${label} is required.`];
    }
  }

  const email = (fields.email ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = ["Please enter a valid email address."];
  }

  const dob = (fields.dob ?? "").trim();
  if (dob) {
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) {
      errors.dob = ["Please enter a valid date."];
    } else if (dobDate >= new Date()) {
      errors.dob = ["Date of birth cannot be in the future."];
    }
  }

  const state = (fields.state ?? "").trim();
  if (state && !/^[A-Za-z]{2}$/.test(state)) {
    errors.state = ["State must be a 2-letter code (e.g. CA)."];
  }

  const zip = (fields.zip ?? "").trim();
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
    errors.zip = ["ZIP code must be 5 digits (e.g. 90001)."];
  }

  const authLimit = parseInt((fields.authLimit ?? "").trim(), 10);
  const authLimitStr = (fields.authLimit ?? "").trim();
  if (authLimitStr && (isNaN(authLimit) || authLimit < 0)) {
    errors.authLimit = [
      "Authorization limit must be a non-negative whole number.",
    ];
  }

  validateDollars(fields.copay, "Co-pay", errors, "copay");
  validateDollars(fields.deductible, "Deductible", errors, "deductible");
  validateDollars(fields.deductibleMet, "Deductible met", errors, "deductibleMet");
  validateDollars(fields.outstandingBalance, "Outstanding balance", errors, "outstandingBalance");

  const ps = (fields.paymentStatus ?? "").trim();
  if (ps && !(PAYMENT_STATUSES as readonly string[]).includes(ps)) {
    errors.paymentStatus = ["Please select a valid payment status."];
  }

  const pm = (fields.paymentMethod ?? "").trim();
  if (pm && !(PAYMENT_METHODS as readonly string[]).includes(pm)) {
    errors.paymentMethod = ["Please select a valid payment method."];
  }

  const lpd = (fields.lastPaymentDate ?? "").trim();
  if (lpd) {
    const lpdDate = new Date(lpd);
    if (isNaN(lpdDate.getTime())) {
      errors.lastPaymentDate = ["Please enter a valid last payment date."];
    } else if (lpdDate > new Date()) {
      errors.lastPaymentDate = ["Last payment date cannot be in the future."];
    }
  }

  return errors;
}

function dollarsToCents(value: string | undefined): number | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const num = parseFloat(v);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

export function buildPatientData(fields: PatientFields) {
  return {
    firstName: fields.firstName.trim(),
    lastName: fields.lastName.trim(),
    dob: new Date(fields.dob.trim()),
    phone: fields.phone.trim(),
    email: fields.email.trim().toLowerCase(),
    address: fields.address.trim(),
    city: fields.city.trim(),
    state: fields.state.trim().toUpperCase(),
    zip: fields.zip.trim(),
    insurer: fields.insurer.trim(),
    memberId: fields.memberId.trim(),
    authLimit: parseInt(fields.authLimit.trim(), 10),
    statusNotes: fields.statusNotes?.trim() || null,
    copayCents: dollarsToCents(fields.copay),
    deductibleCents: dollarsToCents(fields.deductible),
    deductibleMetCents: dollarsToCents(fields.deductibleMet),
    paymentStatus: (fields.paymentStatus ?? "").trim() || null,
    outstandingBalanceCents: dollarsToCents(fields.outstandingBalance),
    lastPaymentDate:
      (fields.lastPaymentDate ?? "").trim()
        ? new Date(fields.lastPaymentDate!.trim())
        : null,
    paymentMethod: (fields.paymentMethod ?? "").trim() || null,
  };
}

/** Format integer cents as a dollar string, e.g. 3000 → "30.00" */
export function centsToDollars(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}
