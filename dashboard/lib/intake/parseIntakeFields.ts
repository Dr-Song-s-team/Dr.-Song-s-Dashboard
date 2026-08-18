import type { PatientFields } from "../validatePatient";

export type IntakeAutofillFields = Partial<PatientFields>;

function compact(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function valueAfterLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const expression = new RegExp(`^\\s*(?:${label})\\s*[:#-]\\s*(.*?)\\s*$`, "i");
    const line = text.split("\n").find((candidate) => expression.test(candidate));
    const match = line?.match(expression);
    const value = compact(match?.[1] ?? "");

    if (
      value &&
      !/^(?:please choose|m\/d\/yyyy|select(?: file)?|none|n\/a|(?:first|last|middle) name:?)$/i.test(value) &&
      !/(?:first name|last name|date of birth|mobile phone|home phone|work phone|email|street address|apt\.?\/unit|city|state|zip(?: code)?|insurance|member id|policy|preferred contact(?: method)?)\s*[:#]/i.test(value)
    ) {
      return value;
    }
  }

  return "";
}

function normalizeDate(value: string) {
  const iso = value.match(/\b((?:19|20)\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const us = value.match(/\b(\d{1,2})[-/](\d{1,2})[-/]((?:19|20)\d{2})\b/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }

  return "";
}

function normalizeState(value: string) {
  const match = value.match(/\b([A-Za-z]{2})\b/);
  return match ? match[1].toUpperCase() : "";
}

/**
 * Extract values from a text-based intake PDF exported with field labels.
 *
 * This intentionally does not guess missing fields. A caller can distinguish
 * an incomplete intake from a fully completed one and prompt staff to review it.
 */
export function parseIntakeFields(pdfText: string): IntakeAutofillFields {
  const text = pdfText.replace(/\r/g, "\n");

  // Accept one or more AcroForm field name aliases; returns the first non-empty match.
  // Supports both the canonical scheme (patient.first_name) and the Dr. Song
  // multilingual scheme (patient_en.first_name, insurance_primary.id, etc.).
  const formFieldValue = (...names: string[]) =>
    names.reduce<string>((acc, name) => acc || valueAfterLabel(text, [`PDF form field ${name}`]), "");

  const formAddress = compact(
    [
      formFieldValue("patient.street_address", "patient_en.street_address"),
      formFieldValue("patient.apt_unit", "patient_en.apt_unit"),
    ]
      .filter(Boolean)
      .join(", "),
  );
  const address = valueAfterLabel(text, ["Street Address", "Address"]);
  const city = valueAfterLabel(text, ["City"]);
  const state = normalizeState(valueAfterLabel(text, ["State"]));
  const zip = valueAfterLabel(text, ["Zip Code", "Zip"]);
  const combinedLocation = compact(`${city}, ${state} ${zip}`);

  const fields: IntakeAutofillFields = {
    firstName:
      formFieldValue("patient.first_name", "patient_en.first_name") ||
      valueAfterLabel(text, ["First Name", "Given Name"]),
    lastName:
      formFieldValue("patient.last_name", "patient_en.last_name") ||
      valueAfterLabel(text, ["Last Name", "Family Name"]),
    dob: normalizeDate(
      formFieldValue("patient.dob", "patient_en.date_of_birth") ||
        valueAfterLabel(text, ["Date of Birth", "DOB"]),
    ),
    phone:
      formFieldValue("patient.mobile_phone", "patient_en.mobile_phone") ||
      formFieldValue("patient.home_phone", "patient_en.home_phone") ||
      formFieldValue("patient_en.work_phone") ||
      valueAfterLabel(text, ["Mobile Phone", "Cell Phone", "Home Phone", "Work Phone"]),
    email:
      formFieldValue("patient.email", "patient_en.email") ||
      valueAfterLabel(text, ["Email(?: Address)?"]),
    address: formAddress || address,
    city: formFieldValue("patient.city", "patient_en.city") || city,
    state: normalizeState(formFieldValue("patient.state", "patient_en.state") || state),
    zip: formFieldValue("patient.zip", "patient_en.zip_code") || zip,
    // insurance_primary.text_109 is the primary company name field in the Dr. Song
    // multilingual AcroForm; insurance_primary.id is its member/policy ID field.
    insurer:
      formFieldValue("insurance.primary.company", "insurance_primary.text_109") ||
      valueAfterLabel(text, [
        "Primary Insurance(?: Company| Carrier)?",
        "Insurance (?:Company|Carrier)",
      ]),
    memberId:
      formFieldValue("insurance.primary.member_id", "insurance_primary.id") ||
      valueAfterLabel(text, ["Member (?:ID|Id)", "Policy (?:Number|#)"]),
    authLimit:
      formFieldValue("patient.auth_limit") ||
      valueAfterLabel(text, [
        "Authorization(?: Visit)? Limit",
        "Authorized Visits?",
        "Visits Authorized",
        "Units Approved",
      ]).replace(/[^\d]/g, ""),
    statusNotes:
      formFieldValue("patient.status_notes") ||
      valueAfterLabel(text, ["Status Notes?", "Notes?"]),
  };

  // Some exports use a single `City, ST 12345` line rather than separate fields.
  if ((!fields.city || !fields.state || !fields.zip) && combinedLocation !== ",") {
    const location = text.match(
      /(?:City,\s*State,?\s*Zip(?: Code)?|City\/State\/Zip)\s*[:#-]\s*([^\n\r]+)/i,
    );
    const parsed = compact(location?.[1] ?? "").match(
      /^(.+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/,
    );
    if (parsed) {
      fields.city ||= parsed[1].trim();
      fields.state ||= parsed[2].toUpperCase();
      fields.zip ||= parsed[3];
    }
  }

  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => Boolean(value)),
  ) as IntakeAutofillFields;
}
