import Link from "next/link";
import IntakeForm from "./IntakeForm";

export const metadata = { title: "New Patient — Dr. Song" };

export default function NewPatientPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/info"
          className="flex size-9 items-center justify-center rounded-xl border border-[#d8c9ba] text-[#765d4e] transition hover:border-[#9b6a4b] hover:text-[#7a5138]"
          aria-label="Back to patient list"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a5138]">
            Patient Records
          </p>
          <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-[#4a3327]">
            New Patient Intake
          </h2>
        </div>
      </div>

      <div className="rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/65 p-8 shadow-[0_24px_70px_rgba(93,63,44,0.08)] backdrop-blur-sm">
        <IntakeForm />
      </div>
    </div>
  );
}
