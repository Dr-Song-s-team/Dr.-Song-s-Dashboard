"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition, useRef } from "react";

type ViewMode = "grid" | "list";

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  insurer: string;
  memberId: string;
  authLimit: number;
  visitsUsed: number;
  statusNotes: string | null;
};

function VisitBarInline({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const urgent = limit > 0 && used / limit >= 0.9;
  return (
    <div
      className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[#e8d9cc]"
      title={`${used} / ${limit} visits`}
    >
      <div
        className={`h-full rounded-full ${urgent ? "bg-rose-500" : "bg-[#9b6a4b]"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function GridIcon() {
  return (
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
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
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
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3" cy="6" r="1" />
      <circle cx="3" cy="12" r="1" />
      <circle cx="3" cy="18" r="1" />
    </svg>
  );
}

export function PatientViewToggle({
  patients,
  initialQuery,
  initialView,
}: {
  patients: Patient[];
  initialQuery: string;
  initialView: ViewMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const view = initialView;

  const setView = useCallback(
    (next: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "grid") {
        params.delete("view");
      } else {
        params.set("view", next);
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value.trim()) {
          params.set("q", value.trim());
        } else {
          params.delete("q");
        }
        startTransition(() => {
          router.push(`${pathname}?${params.toString()}`);
        });
      }, 300);
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Search + toggle bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9b8070]"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            defaultValue={initialQuery}
            onChange={(e) => handleSearch(e.currentTarget.value)}
            placeholder="Search by patient name…"
            aria-label="Search patients by name"
            className="w-full rounded-xl border border-[#d8c9ba] bg-white/70 py-2.5 pl-10 pr-4 text-sm text-[#513a2e] placeholder-[#9b8070] outline-none transition focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/40"
          />
        </div>

        {/* View toggle */}
        <div
          className="flex rounded-xl border border-[#d8c9ba] bg-white/70 p-1"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              view === "grid"
                ? "bg-[#9b6a4b] text-[#fffaf2] shadow-sm"
                : "text-[#765d4e] hover:bg-[#f0e6d8]"
            }`}
          >
            <GridIcon />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              view === "list"
                ? "bg-[#9b6a4b] text-[#fffaf2] shadow-sm"
                : "text-[#765d4e] hover:bg-[#f0e6d8]"
            }`}
          >
            <ListIcon />
            List
          </button>
        </div>
      </div>

      {patients.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/65 p-12 text-center shadow-[0_24px_70px_rgba(93,63,44,0.08)] backdrop-blur-sm">
          <div>
            <p className="text-lg font-medium text-[#4a3327]">No patients found</p>
            <p className="mt-2 text-sm text-[#765d4e]">
              Try a different name or clear the search.
            </p>
          </div>
        </div>
      ) : view === "grid" ? (
        <GridView patients={patients} />
      ) : (
        <ListView patients={patients} />
      )}
    </div>
  );
}

function GridView({ patients }: { patients: Patient[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {patients.map((patient) => {
        const pct =
          patient.authLimit > 0
            ? Math.min((patient.visitsUsed / patient.authLimit) * 100, 100)
            : 0;
        const urgent =
          patient.authLimit > 0 && patient.visitsUsed / patient.authLimit >= 0.9;
        return (
          <a
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

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={urgent ? "font-semibold text-rose-600" : "text-[#765d4e]"}>
                  {patient.visitsUsed} / {patient.authLimit} visits
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

            {patient.statusNotes && (
              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#765d4e]">
                {patient.statusNotes}
              </p>
            )}
          </a>
        );
      })}
    </div>
  );
}

function ListView({ patients }: { patients: Patient[] }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[#8c6349]/10 bg-[#fffaf2]/80 shadow-sm backdrop-blur-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e8d9cc] bg-[#faf5ee]">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#9b8070]">
              Patient
            </th>
            <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#9b8070] sm:table-cell">
              Insurer
            </th>
            <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#9b8070] md:table-cell">
              Member ID
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#9b8070]">
              Auth
            </th>
            <th className="w-8 px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e8d9cc]">
          {patients.map((patient) => {
            const urgent =
              patient.authLimit > 0 &&
              patient.visitsUsed / patient.authLimit >= 0.9;
            return (
              <tr
                key={patient.id}
                className="group cursor-pointer transition hover:bg-[#f5ede4]/60"
                onClick={() => (window.location.href = `/info/${patient.id}`)}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#9b6a4b]/10 text-sm font-bold text-[#7a5138]">
                      {patient.firstName[0]}
                      {patient.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#4a3327] group-hover:text-[#7a5138]">
                        {patient.lastName}, {patient.firstName}
                      </p>
                      <p className="truncate text-xs text-[#765d4e]">{patient.email}</p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-5 py-3.5 text-[#513a2e] sm:table-cell">
                  {patient.insurer}
                </td>
                <td className="hidden px-5 py-3.5 font-mono text-xs text-[#513a2e] md:table-cell">
                  {patient.memberId}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs tabular-nums ${urgent ? "font-semibold text-rose-600" : "text-[#765d4e]"}`}
                    >
                      {patient.visitsUsed}/{patient.authLimit}
                    </span>
                    <VisitBarInline used={patient.visitsUsed} limit={patient.authLimit} />
                  </div>
                </td>
                <td className="px-3 py-3.5 text-right">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto size-4 text-[#9b6a4b] opacity-0 transition group-hover:opacity-100"
                    aria-hidden="true"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
