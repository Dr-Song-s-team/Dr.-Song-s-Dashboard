import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Patient / Admin Info — Dr. Song" };

function VisitBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const urgent = limit > 0 && used / limit >= 0.9;
  return (
    <div className="mt-1">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={urgent ? "font-semibold text-rose-600" : "text-[#765d4e]"}>
          {used} / {limit} visits
        </span>
        {urgent && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
            Near limit
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8d9cc]">
        <div
          className={`h-full rounded-full transition-all ${
            urgent ? "bg-rose-500" : "bg-[#9b6a4b]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function PatientListPage() {
  await connection();
  const patients = await prisma.patient.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dob: true,
      phone: true,
      email: true,
      insurer: true,
      memberId: true,
      authLimit: true,
      visitsUsed: true,
      statusNotes: true,
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a5138]">
            Patient Records
          </p>
          <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-[#4a3327]">
            Patient / Admin Info
          </h2>
        </div>
        <Link
          href="/info/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#9b6a4b] px-4 py-2.5 text-sm font-medium text-[#fffaf2] shadow-sm transition hover:bg-[#7a5138] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6a4b]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Patient
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/65 p-12 text-center shadow-[0_24px_70px_rgba(93,63,44,0.08)] backdrop-blur-sm">
          <div>
            <p className="text-lg font-medium text-[#4a3327]">No patients yet</p>
            <p className="mt-2 text-sm text-[#765d4e]">
              Add a new patient using the button above.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {patients.map((patient) => (
            <Link
              key={patient.id}
              href={`/info/${patient.id}`}
              className="group rounded-[1.5rem] border border-[#8c6349]/10 bg-[#fffaf2]/80 p-5 shadow-sm backdrop-blur-sm transition-all hover:border-[#9b6a4b]/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#9b6a4b]/10 text-base font-bold text-[#7a5138]">
                  {patient.firstName[0]}
                  {patient.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#4a3327] group-hover:text-[#7a5138]">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className="truncate text-xs text-[#765d4e]">{patient.email}</p>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 shrink-0 text-[#9b6a4b] opacity-0 transition group-hover:opacity-100"
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>

              <div className="mt-4 space-y-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#9b8070]">
                    Insurer
                  </span>
                  <span className="truncate text-right text-xs text-[#513a2e]">
                    {patient.insurer}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#9b8070]">
                    Member ID
                  </span>
                  <span className="truncate text-right font-mono text-xs text-[#513a2e]">
                    {patient.memberId}
                  </span>
                </div>
              </div>

              <VisitBar used={patient.visitsUsed} limit={patient.authLimit} />

              {patient.statusNotes && (
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#765d4e]">
                  {patient.statusNotes}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
