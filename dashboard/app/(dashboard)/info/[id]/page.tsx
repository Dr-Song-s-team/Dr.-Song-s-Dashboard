import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditForm from "./EditForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await prisma.patient.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  });
  if (!patient) return { title: "Patient Not Found — Dr. Song" };
  return { title: `${patient.firstName} ${patient.lastName} — Dr. Song` };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <dt className="w-36 shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-[#9b8070]">
        {label}
      </dt>
      <dd className="text-sm text-[#513a2e]">{value}</dd>
    </div>
  );
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await prisma.patient.findUnique({ where: { id } });

  if (!patient) notFound();

  const visitPct =
    patient.authLimit > 0
      ? Math.min((patient.visitsUsed / patient.authLimit) * 100, 100)
      : 0;
  const nearLimit =
    patient.authLimit > 0 && patient.visitsUsed / patient.authLimit >= 0.9;

  const dobFormatted = patient.dob.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
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
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a5138]">
            Patient Record
          </p>
          <h2 className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-[#4a3327]">
            {patient.firstName} {patient.lastName}
          </h2>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Summary card */}
        <div className="rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/65 p-6 shadow-[0_24px_70px_rgba(93,63,44,0.08)] backdrop-blur-sm lg:col-span-1">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#9b6a4b]/10 text-lg font-bold text-[#7a5138]">
              {patient.firstName[0]}
              {patient.lastName[0]}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#4a3327]">
                {patient.firstName} {patient.lastName}
              </p>
              <p className="truncate text-xs text-[#765d4e]">{patient.email}</p>
            </div>
          </div>

          <dl className="divide-y divide-[#e8d9cc]">
            <InfoRow label="DOB" value={dobFormatted} />
            <InfoRow label="Phone" value={patient.phone} />
            <InfoRow label="Address" value={patient.address} />
            <InfoRow
              label="City / State"
              value={`${patient.city}, ${patient.state} ${patient.zip}`}
            />
          </dl>

          <div className="mt-5 rounded-xl border border-[#e8d9cc] bg-[#faf5ee] p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7a5138]">
              Insurance
            </p>
            <p className="font-medium text-[#4a3327]">{patient.insurer}</p>
            <p className="font-mono text-sm text-[#765d4e]">{patient.memberId}</p>
          </div>

          {/* Authorization bar */}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-[#7a5138]">Authorization</span>
              <span
                className={
                  nearLimit ? "font-semibold text-rose-600" : "text-[#765d4e]"
                }
              >
                {patient.visitsUsed} / {patient.authLimit} visits
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8d9cc]">
              <div
                className={`h-full rounded-full ${nearLimit ? "bg-rose-500" : "bg-[#9b6a4b]"}`}
                style={{ width: `${visitPct}%` }}
              />
            </div>
            {nearLimit && (
              <p className="mt-1.5 text-xs text-rose-600">
                Patient is at or near authorization limit.
              </p>
            )}
          </div>

          {patient.statusNotes && (
            <div className="mt-4 rounded-xl border border-[#e8d9cc] bg-[#faf5ee] p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7a5138]">
                Status Notes
              </p>
              <p className="text-sm leading-relaxed text-[#513a2e]">
                {patient.statusNotes}
              </p>
            </div>
          )}
        </div>

        {/* Edit form */}
        <div className="rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/65 p-8 shadow-[0_24px_70px_rgba(93,63,44,0.08)] backdrop-blur-sm lg:col-span-2">
          <h3 className="mb-6 text-base font-semibold text-[#4a3327]">
            Edit Patient Record
          </h3>
          <EditForm patient={patient} />
        </div>
      </div>
    </div>
  );
}
