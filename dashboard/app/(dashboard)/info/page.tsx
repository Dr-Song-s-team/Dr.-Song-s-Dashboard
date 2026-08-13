import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { PatientViewToggle } from "./PatientViewToggle";

export const metadata = { title: "Patient / Admin Info — Dr. Song" };

type SearchParams = Promise<{ q?: string; view?: string }>;

type ViewMode = "grid" | "list";

export default async function PatientListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  const { q, view } = await searchParams;

  const query = (q ?? "").trim();
  const viewMode: ViewMode = view === "list" ? "list" : "grid";

  const searchFilter = query
    ? {
        OR: [
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const patients = await prisma.patient.findMany({
    where: searchFilter,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
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
      {/* Page header */}
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

      {patients.length === 0 && !query ? (
        <div className="flex flex-1 items-center justify-center rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/65 p-12 text-center shadow-[0_24px_70px_rgba(93,63,44,0.08)] backdrop-blur-sm">
          <div>
            <p className="text-lg font-medium text-[#4a3327]">No patients yet</p>
            <p className="mt-2 text-sm text-[#765d4e]">
              Add a new patient using the button above.
            </p>
          </div>
        </div>
      ) : (
        <Suspense>
          <PatientViewToggle
            patients={patients}
            initialQuery={query}
            initialView={viewMode}
          />
        </Suspense>
      )}
    </div>
  );
}
