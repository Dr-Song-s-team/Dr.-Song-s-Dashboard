"use client";

import { useRouter } from "next/navigation";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface FormType {
  type: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface FormSelectorProps {
  formType: FormType;
  patients: Patient[];
}

export default function FormSelector({ formType, patients }: FormSelectorProps) {
  const router = useRouter();

  return (
    <div className="rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/80 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#9b6a4b]/10 text-[#7a5138]">
          {formType.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[#4a3327]">{formType.title}</h3>
          <p className="mt-1 text-sm text-[#765d4e]">{formType.description}</p>
        </div>
      </div>

      <div className="mt-6">
        <label
          htmlFor={`patient-${formType.type}`}
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#7a5138]"
        >
          Select Patient
        </label>
        <select
          id={`patient-${formType.type}`}
          className="w-full rounded-xl border border-[#d8c9ba] bg-white/70 px-3.5 py-2.5 text-sm text-[#513a2e] outline-none transition focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/40"
          onChange={(e) => {
            if (e.target.value) {
              router.push(`/insurance/${formType.type}?patientId=${e.target.value}`);
            }
          }}
          defaultValue=""
        >
          <option value="" disabled>
            Choose a patient...
          </option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.lastName}, {patient.firstName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
