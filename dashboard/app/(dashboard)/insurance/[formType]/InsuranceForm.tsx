"use client";

import { useState } from "react";
import Link from "next/link";
import type { FormTemplate, FieldDefinition } from "@/lib/insurance/templates";
import { getFieldsBySection } from "@/lib/insurance/templates";
import AiDraftLabel from "@/components/AiDraftLabel";

type AIFilledFields = Set<string>;

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

interface Patient {
  id: string;
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
}

interface InsuranceFormProps {
  template: FormTemplate;
  patient: Patient;
  sections: string[];
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#7a5138]"
    >
      {children}
    </label>
  );
}

function Input({
  id,
  name,
  type = "text",
  required,
  value,
  onChange,
  placeholder,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      required={required}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-xl border border-[#d8c9ba] bg-white/70 px-3.5 py-2.5 text-sm text-[#513a2e] placeholder-[#9b8070] outline-none transition focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/40"
      {...rest}
    />
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
  isAiFilled,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  isAiFilled: boolean;
}) {
  const fieldId = `field-${field.key}`;
  const isManual = !field.aiFillable;

  return (
    <div>
      <Label htmlFor={fieldId}>
        {field.label} {field.required && "*"}
        {isManual && (
          <span className="ml-2 rounded-full bg-[#9b6a4b]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#7a5138]">
            Manual
          </span>
        )}
        {isAiFilled && <AiDraftLabel />}
      </Label>
      {field.type === "textarea" ? (
        <textarea
          id={fieldId}
          name={field.key}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows || 3}
          className={`w-full rounded-xl border bg-white/70 px-3.5 py-2.5 text-sm text-[#513a2e] placeholder-[#9b8070] outline-none transition focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/40 ${
            isAiFilled ? "border-l-4 border-amber-400" : "border-[#d8c9ba]"
          }`}
        />
      ) : field.type === "select" ? (
        <select
          id={fieldId}
          name={field.key}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-xl border bg-white/70 px-3.5 py-2.5 text-sm text-[#513a2e] outline-none transition focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/40 ${
            isAiFilled ? "border-l-4 border-amber-400" : "border-[#d8c9ba]"
          }`}
        >
          <option value="">Select...</option>
          {field.key === "patientState" || field.key.toLowerCase().includes("state") ? (
            US_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))
          ) : (
            field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))
          )}
        </select>
      ) : (
        <Input
          id={fieldId}
          name={field.key}
          type={field.type}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={isAiFilled ? "border-l-4 border-amber-400" : ""}
        />
      )}
    </div>
  );
}

export default function InsuranceForm({ template, patient, sections }: InsuranceFormProps) {
  // Initialize form data with patient data where applicable
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    template.fields.forEach((field) => {
      // Auto-populate from patient data if field key matches
      if (field.key === "patientFirstName") initial[field.key] = patient.firstName;
      else if (field.key === "patientLastName") initial[field.key] = patient.lastName;
      else if (field.key === "patientDOB") {
        initial[field.key] = new Date(patient.dob).toISOString().split("T")[0];
      } else if (field.key === "patientPhone") initial[field.key] = patient.phone;
      else if (field.key === "patientAddress") initial[field.key] = patient.address;
      else if (field.key === "patientCity") initial[field.key] = patient.city;
      else if (field.key === "patientState") initial[field.key] = patient.state;
      else if (field.key === "patientZip") initial[field.key] = patient.zip;
      else if (field.key === "insurer") initial[field.key] = patient.insurer;
      else if (field.key === "memberId") initial[field.key] = patient.memberId;
      else initial[field.key] = "";
    });
    return initial;
  });

  // Track which fields were filled by AI
  const [aiFilledFields, setAiFilledFields] = useState<AIFilledFields>(new Set());

  // Autofill loading/error states
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);

  // Save loading/error states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Clear AI-filled marker when user manually edits field
    if (aiFilledFields.has(key)) {
      setAiFilledFields((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleAutofill = async () => {
    setIsAutofilling(true);
    setAutofillError(null);

    try {
      const response = await fetch("/api/insurance/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: template.type,
          patientId: patient.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const { fields, filledCount } = data;

      // Update form data with AI-filled fields
      setFormData((prev) => ({ ...prev, ...fields }));

      // Mark AI-filled fields
      setAiFilledFields(new Set(Object.keys(fields)));

      // Show success message (optional)
      if (filledCount === 0) {
        setAutofillError("No fields could be filled with available data");
      }
    } catch (error) {
      console.error("Autofill failed:", error);
      setAutofillError(
        error instanceof Error ? error.message : "Failed to autofill form"
      );
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch("/api/insurance/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: template.type,
          patientId: patient.id,
          formData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      setSaveSuccess(true);
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Save failed:", error);
      setSaveError(
        error instanceof Error ? error.message : "Failed to save form"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form noValidate className="space-y-8">
      {/* Autofill button at top */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">AI Autofill</p>
          <p className="text-xs text-amber-700">
            Fill form fields automatically using patient data and documents
          </p>
        </div>
        <button
          type="button"
          onClick={handleAutofill}
          disabled={isAutofilling}
          className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAutofilling ? "Autofilling..." : "Autofill with AI"}
        </button>
      </div>

      {/* Error message */}
      {autofillError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">Autofill Error</p>
          <p className="text-xs text-red-700">{autofillError}</p>
        </div>
      )}

      {sections.map((section) => {
        const fields = getFieldsBySection(template, section);
        return (
          <section key={section}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6a4b]">
              {section}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={
                    field.type === "textarea" || field.key.toLowerCase().includes("description")
                      ? "sm:col-span-2"
                      : ""
                  }
                >
                  <FieldRenderer
                    field={field}
                    value={formData[field.key] || ""}
                    onChange={(value) => handleFieldChange(field.key, value)}
                    isAiFilled={aiFilledFields.has(field.key)}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="flex items-center justify-between gap-3 border-t border-[#e8d9cc] pt-6">
        <Link
          href="/insurance"
          className="rounded-xl border border-[#d8c9ba] px-5 py-2.5 text-sm font-medium text-[#513a2e] transition hover:bg-[#f0e6d8]"
        >
          Back to Forms
        </Link>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <p className="text-xs font-medium text-green-700">
              Form saved successfully!
            </p>
          )}
          {saveError && (
            <p className="text-xs font-medium text-red-700">
              {saveError}
            </p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl bg-[#9b6a4b] px-6 py-2.5 text-sm font-medium text-[#fffaf2] shadow-sm transition hover:bg-[#7a5138] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Form"}
          </button>
        </div>
      </div>
    </form>
  );
}
