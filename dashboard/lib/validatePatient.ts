/**
 * Pure validation for patient intake/edit form fields.
 * Kept separate from the Server Action so it can be unit-tested without
 * Next.js server-context dependencies.
 */

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

  return errors;
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
  };
}
