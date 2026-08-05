/**
 * Insurance form templates for CMS-1500, ASH MNR, and PI Report.
 * Field definitions include type, label, required status, section grouping,
 * and aiFillable flag (true = AI will populate in #14, false = manual only).
 */

export type FieldType = "text" | "date" | "number" | "textarea" | "select";

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  section: string;
  aiFillable: boolean;
  options?: string[]; // for select fields
  placeholder?: string;
  rows?: number; // for textarea fields
}

export interface FormTemplate {
  type: "CMS_1500" | "ASH_MNR" | "PI_REPORT";
  title: string;
  description: string;
  fields: FieldDefinition[];
}

// CMS-1500: Health Insurance Claim Form
export const CMS_1500_TEMPLATE: FormTemplate = {
  type: "CMS_1500",
  title: "CMS-1500 Health Insurance Claim Form",
  description: "Standard claim form for professional health services",
  fields: [
    // Patient Information
    {
      key: "patientFirstName",
      label: "Patient First Name",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
      placeholder: "First name",
    },
    {
      key: "patientLastName",
      label: "Patient Last Name",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
      placeholder: "Last name",
    },
    {
      key: "patientDOB",
      label: "Date of Birth",
      type: "date",
      required: true,
      section: "Patient Information",
      aiFillable: true,
    },
    {
      key: "patientAddress",
      label: "Street Address",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
      placeholder: "123 Main St",
    },
    {
      key: "patientCity",
      label: "City",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
    },
    {
      key: "patientState",
      label: "State",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
      placeholder: "CA",
    },
    {
      key: "patientZip",
      label: "ZIP Code",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
      placeholder: "90001",
    },

    // Insurance Information
    {
      key: "insurer",
      label: "Insurance Company",
      type: "text",
      required: true,
      section: "Insurance Information",
      aiFillable: true,
      placeholder: "Anthem Blue Cross",
    },
    {
      key: "memberId",
      label: "Member ID",
      type: "text",
      required: true,
      section: "Insurance Information",
      aiFillable: true,
      placeholder: "ANT-2024-001",
    },

    // Clinical Information
    {
      key: "diagnosisCodes",
      label: "Diagnosis Codes (ICD-10)",
      type: "textarea",
      required: true,
      section: "Clinical Information",
      aiFillable: true,
      placeholder: "e.g. M54.5",
      rows: 3,
    },
    {
      key: "serviceStartDate",
      label: "Service Start Date",
      type: "date",
      required: true,
      section: "Clinical Information",
      aiFillable: true,
    },
    {
      key: "serviceEndDate",
      label: "Service End Date",
      type: "date",
      required: true,
      section: "Clinical Information",
      aiFillable: true,
    },
    {
      key: "cptCodes",
      label: "CPT Procedure Codes",
      type: "textarea",
      required: true,
      section: "Clinical Information",
      aiFillable: true,
      placeholder: "e.g. 98940",
      rows: 3,
    },
    {
      key: "charges",
      label: "Total Charges",
      type: "number",
      required: true,
      section: "Clinical Information",
      aiFillable: true,
      placeholder: "0.00",
    },

    // Provider Information
    {
      key: "providerName",
      label: "Provider Name",
      type: "text",
      required: true,
      section: "Provider Information",
      aiFillable: true,
      placeholder: "Provider name",
    },
    {
      key: "providerNPI",
      label: "Provider NPI",
      type: "text",
      required: true,
      section: "Provider Information",
      aiFillable: true,
      placeholder: "10-digit NPI",
    },
    {
      key: "providerAddress",
      label: "Provider Address",
      type: "text",
      required: true,
      section: "Provider Information",
      aiFillable: true,
    },
    {
      key: "providerPhone",
      label: "Provider Phone",
      type: "text",
      required: true,
      section: "Provider Information",
      aiFillable: true,
      placeholder: "Phone number",
    },

    // Signatures (manual only)
    {
      key: "patientSignatureDate",
      label: "Patient Signature Date",
      type: "date",
      required: true,
      section: "Signatures",
      aiFillable: false,
    },
    {
      key: "providerSignatureDate",
      label: "Provider Signature Date",
      type: "date",
      required: true,
      section: "Signatures",
      aiFillable: false,
    },
  ],
};

// ASH MNR: Authorization / Medical Necessity Request
export const ASH_MNR_TEMPLATE: FormTemplate = {
  type: "ASH_MNR",
  title: "Authorization & Medical Necessity Request",
  description: "Request form for treatment authorization and medical necessity justification",
  fields: [
    // Patient Information
    {
      key: "patientFirstName",
      label: "Patient First Name",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
      placeholder: "First name",
    },
    {
      key: "patientLastName",
      label: "Patient Last Name",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
      placeholder: "Last name",
    },
    {
      key: "patientDOB",
      label: "Date of Birth",
      type: "date",
      required: true,
      section: "Patient Information",
      aiFillable: true,
    },
    {
      key: "memberId",
      label: "Member ID",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
      placeholder: "ANT-2024-001",
    },

    // Diagnosis & Treatment
    {
      key: "primaryDiagnosis",
      label: "Primary Diagnosis",
      type: "text",
      required: true,
      section: "Diagnosis & Treatment",
      aiFillable: true,
      placeholder: "Low back pain (M54.5)",
    },
    {
      key: "diagnosisCode",
      label: "ICD-10 Code",
      type: "text",
      required: true,
      section: "Diagnosis & Treatment",
      aiFillable: true,
      placeholder: "M54.5",
    },
    {
      key: "treatmentHistory",
      label: "Treatment History",
      type: "textarea",
      required: true,
      section: "Diagnosis & Treatment",
      aiFillable: true,
      placeholder: "Patient has received chiropractic care since...",
      rows: 4,
    },

    // Authorization Request
    {
      key: "visitsUsed",
      label: "Visits Used (Current Authorization)",
      type: "number",
      required: true,
      section: "Authorization Request",
      aiFillable: true,
      placeholder: "20",
    },
    {
      key: "visitsRequested",
      label: "Additional Visits Requested",
      type: "number",
      required: true,
      section: "Authorization Request",
      aiFillable: true,
      placeholder: "12",
    },
    {
      key: "requestStartDate",
      label: "Requested Start Date",
      type: "date",
      required: true,
      section: "Authorization Request",
      aiFillable: true,
    },
    {
      key: "requestEndDate",
      label: "Requested End Date",
      type: "date",
      required: true,
      section: "Authorization Request",
      aiFillable: true,
    },

    // Clinical Justification
    {
      key: "clinicalJustification",
      label: "Clinical Justification / Medical Necessity",
      type: "textarea",
      required: true,
      section: "Clinical Justification",
      aiFillable: true,
      placeholder: "Patient requires continued care due to...",
      rows: 6,
    },
    {
      key: "functionalGoals",
      label: "Functional Goals",
      type: "textarea",
      required: true,
      section: "Clinical Justification",
      aiFillable: true,
      placeholder: "Improve ROM, reduce pain...",
      rows: 3,
    },

    // Provider Information
    {
      key: "providerName",
      label: "Provider Name",
      type: "text",
      required: true,
      section: "Provider Information",
      aiFillable: true,
      placeholder: "Provider name",
    },
    {
      key: "providerNPI",
      label: "Provider NPI",
      type: "text",
      required: true,
      section: "Provider Information",
      aiFillable: true,
      placeholder: "10-digit NPI",
    },
    {
      key: "providerPhone",
      label: "Provider Phone",
      type: "text",
      required: true,
      section: "Provider Information",
      aiFillable: true,
      placeholder: "Phone number",
    },

    // Signature (manual only)
    {
      key: "providerSignatureDate",
      label: "Provider Signature Date",
      type: "date",
      required: true,
      section: "Signatures",
      aiFillable: false,
    },
  ],
};

// PI Report: Personal Injury Report
export const PI_REPORT_TEMPLATE: FormTemplate = {
  type: "PI_REPORT",
  title: "Personal Injury Report",
  description: "Detailed report for accident-related injuries and treatment",
  fields: [
    // Patient Information
    {
      key: "patientFirstName",
      label: "Patient First Name",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
      placeholder: "First name",
    },
    {
      key: "patientLastName",
      label: "Patient Last Name",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
      placeholder: "Last name",
    },
    {
      key: "patientDOB",
      label: "Date of Birth",
      type: "date",
      required: true,
      section: "Patient Information",
      aiFillable: true,
    },
    {
      key: "patientPhone",
      label: "Patient Phone",
      type: "text",
      required: true,
      section: "Patient Information",
      aiFillable: true,
      placeholder: "Phone number",
    },

    // Accident Details
    {
      key: "injuryDate",
      label: "Date of Injury",
      type: "date",
      required: true,
      section: "Accident Details",
      aiFillable: true,
    },
    {
      key: "accidentType",
      label: "Type of Accident",
      type: "select",
      required: true,
      section: "Accident Details",
      aiFillable: true,
      options: [
        "Motor Vehicle Accident",
        "Slip and Fall",
        "Work-Related Injury",
        "Sports Injury",
        "Other",
      ],
    },
    {
      key: "accidentDescription",
      label: "Accident Description",
      type: "textarea",
      required: true,
      section: "Accident Details",
      aiFillable: true,
      placeholder: "Describe how the accident occurred...",
      rows: 4,
    },

    // Clinical Examination
    {
      key: "chiefComplaint",
      label: "Chief Complaint",
      type: "textarea",
      required: true,
      section: "Clinical Examination",
      aiFillable: true,
      placeholder: "Patient reports pain in...",
      rows: 3,
    },
    {
      key: "examFindings",
      label: "Examination Findings",
      type: "textarea",
      required: true,
      section: "Clinical Examination",
      aiFillable: true,
      placeholder: "Physical examination reveals...",
      rows: 5,
    },
    {
      key: "diagnosisCode",
      label: "ICD-10 Diagnosis Code",
      type: "text",
      required: true,
      section: "Clinical Examination",
      aiFillable: true,
      placeholder: "S13.4, M54.2",
    },

    // Treatment Plan
    {
      key: "treatmentPlan",
      label: "Recommended Treatment Plan",
      type: "textarea",
      required: true,
      section: "Treatment Plan",
      aiFillable: true,
      placeholder: "Chiropractic adjustments, physical therapy...",
      rows: 4,
    },
    {
      key: "treatmentFrequency",
      label: "Treatment Frequency",
      type: "text",
      required: true,
      section: "Treatment Plan",
      aiFillable: true,
      placeholder: "3x per week for 4 weeks",
    },
    {
      key: "estimatedDuration",
      label: "Estimated Treatment Duration",
      type: "text",
      required: true,
      section: "Treatment Plan",
      aiFillable: true,
      placeholder: "8-12 weeks",
    },

    // Prognosis
    {
      key: "prognosis",
      label: "Prognosis",
      type: "textarea",
      required: true,
      section: "Prognosis",
      aiFillable: true,
      placeholder: "Patient is expected to make...",
      rows: 3,
    },
    {
      key: "functionalLimitations",
      label: "Current Functional Limitations",
      type: "textarea",
      required: true,
      section: "Prognosis",
      aiFillable: true,
      placeholder: "Difficulty sitting, standing, lifting...",
      rows: 3,
    },

    // Provider Information
    {
      key: "providerName",
      label: "Provider Name",
      type: "text",
      required: true,
      section: "Provider Information",
      aiFillable: true,
      placeholder: "Dr. Song",
    },
    {
      key: "providerLicense",
      label: "Provider License Number",
      type: "text",
      required: true,
      section: "Provider Information",
      aiFillable: true,
    },

    // Signature (manual only)
    {
      key: "reportDate",
      label: "Report Date",
      type: "date",
      required: true,
      section: "Signatures",
      aiFillable: false,
    },
  ],
};

// Export all templates as a map
export const FORM_TEMPLATES: Record<string, FormTemplate> = {
  CMS_1500: CMS_1500_TEMPLATE,
  ASH_MNR: ASH_MNR_TEMPLATE,
  PI_REPORT: PI_REPORT_TEMPLATE,
};

// Helper to get sections from a template
export function getSections(template: FormTemplate): string[] {
  const sections = new Set<string>();
  template.fields.forEach((field) => sections.add(field.section));
  return Array.from(sections);
}

// Helper to get fields by section
export function getFieldsBySection(
  template: FormTemplate,
  section: string
): FieldDefinition[] {
  return template.fields.filter((field) => field.section === section);
}
