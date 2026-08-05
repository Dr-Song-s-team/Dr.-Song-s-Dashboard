import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import FormSelector from "./FormSelector";

export const metadata = { title: "Insurance Forms — Dr. Song" };

const FORM_TYPES = [
  {
    type: "CMS_1500",
    title: "CMS-1500",
    description: "Health Insurance Claim Form",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 13h6M9 17h6" />
      </svg>
    ),
  },
  {
    type: "ASH_MNR",
    title: "ASH MNR",
    description: "Authorization & Medical Necessity Request",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
      >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" />
      </svg>
    ),
  },
  {
    type: "PI_REPORT",
    title: "PI Report",
    description: "Personal Injury Report",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
      >
        <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
        <path d="M14 2v6h6M3 15h6M6 12v6" />
      </svg>
    ),
  },
];

export default async function InsuranceListPage() {
  await connection();
  const patients = await prisma.patient.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a5138]">
          Forms & Reports
        </p>
        <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-[#4a3327]">
          Insurance Forms
        </h2>
        <p className="mt-2 text-sm text-[#765d4e]">
          Select a form type and patient to create a new insurance form
        </p>
      </div>

      {patients.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/65 p-12 text-center shadow-[0_24px_70px_rgba(93,63,44,0.08)] backdrop-blur-sm">
          <div>
            <p className="text-lg font-medium text-[#4a3327]">No patients yet</p>
            <p className="mt-2 text-sm text-[#765d4e]">
              Add a patient in the{" "}
              <Link href="/info" className="text-[#9b6a4b] underline hover:text-[#7a5138]">
                Patient / Admin Info
              </Link>{" "}
              section first.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {FORM_TYPES.map((form) => (
            <FormSelector key={form.type} formType={form} patients={patients} />
          ))}
        </div>
      )}

      <div className="rounded-[1.5rem] border border-[#9b6a4b]/20 bg-[#fffaf2]/60 p-6 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#9b6a4b]/15 text-[#7a5138]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[#4a3327]">About Insurance Forms</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#765d4e]">
              These forms are editable templates. AI autocomplete functionality will be added in a
              future update. Fields marked as manual (like signatures) must be filled in by hand.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
