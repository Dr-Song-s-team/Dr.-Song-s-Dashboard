"use client";

import { useState } from "react";
import Link from "next/link";
import type { FormTemplate, FieldDefinition } from "@/lib/insurance/templates";
import { getFieldsBySection } from "@/lib/insurance/templates";

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
}: {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
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
          className="w-full rounded-xl border border-[#d8c9ba] bg-white/70 px-3.5 py-2.5 text-sm text-[#513a2e] placeholder-[#9b8070] outline-none transition focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/40"
        />
      ) : field.type === "select" ? (
        <select
          id={fieldId}
          name={field.key}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-[#d8c9ba] bg-white/70 px-3.5 py-2.5 text-sm text-[#513a2e] outline-none transition focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/40"
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

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form noValidate className="space-y-8">
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
          <p className="text-xs text-[#9b8070]">
            Save functionality will be added in a future update
          </p>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl bg-[#9b6a4b] px-6 py-2.5 text-sm font-medium text-[#fffaf2] opacity-50 shadow-sm"
          >
            Save Form
          </button>
        </div>
      </div>
    </form>
  );
}
