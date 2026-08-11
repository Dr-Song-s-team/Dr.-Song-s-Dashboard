import Link from "next/link";
import { connection } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import InboxEmailList from "@/components/email/InboxEmailList";

export const metadata = { title: "Inbox — Dr. Song" };

const statuses = ["UNREAD", "READ", "NEEDS_ACTION", "ARCHIVED"] as const;
const statusLabels = {
  UNREAD: "Unread",
  READ: "Read",
  NEEDS_ACTION: "Needs action",
  ARCHIVED: "Archived",
} as const;

const classifications = [
  "AUTHORIZATION",
  "CLAIM",
  "REFERRAL",
  "SCHEDULING",
  "BILLING",
  "GENERAL",
] as const;
type Classification = (typeof classifications)[number];

const classificationLabels: Record<Classification, string> = {
  AUTHORIZATION: "Authorization",
  CLAIM: "Claim",
  REFERRAL: "Referral",
  SCHEDULING: "Scheduling",
  BILLING: "Billing",
  GENERAL: "General",
};

const classificationColors: Record<
  Classification,
  { icon: string; card: string; badge: string }
> = {
  AUTHORIZATION: {
    icon: "bg-blue-50 text-blue-600",
    card: "hover:border-blue-200 hover:bg-blue-50/40",
    badge: "bg-blue-100 text-blue-700",
  },
  CLAIM: {
    icon: "bg-amber-50 text-amber-600",
    card: "hover:border-amber-200 hover:bg-amber-50/40",
    badge: "bg-amber-100 text-amber-700",
  },
  REFERRAL: {
    icon: "bg-emerald-50 text-emerald-600",
    card: "hover:border-emerald-200 hover:bg-emerald-50/40",
    badge: "bg-emerald-100 text-emerald-700",
  },
  SCHEDULING: {
    icon: "bg-purple-50 text-purple-600",
    card: "hover:border-purple-200 hover:bg-purple-50/40",
    badge: "bg-purple-100 text-purple-700",
  },
  BILLING: {
    icon: "bg-rose-50 text-rose-600",
    card: "hover:border-rose-200 hover:bg-rose-50/40",
    badge: "bg-rose-100 text-rose-700",
  },
  GENERAL: {
    icon: "bg-slate-50 text-slate-600",
    card: "hover:border-slate-300 hover:bg-slate-50/40",
    badge: "bg-slate-100 text-slate-700",
  },
};

function FolderIcon({ classification }: { classification: Classification }) {
  switch (classification) {
    case "AUTHORIZATION":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-7"
          aria-hidden="true"
        >
          <path d="M12 2 3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "CLAIM":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-7"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
    case "REFERRAL":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-7"
          aria-hidden="true"
        >
          <circle cx="9" cy="7" r="4" />
          <path d="M3 21v-2a7 7 0 0 1 9.33-6.61" />
          <path d="M19 16v6m-3-3h6" />
        </svg>
      );
    case "SCHEDULING":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-7"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        </svg>
      );
    case "BILLING":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-7"
          aria-hidden="true"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      );
    case "GENERAL":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-7"
          aria-hidden="true"
        >
          <path d="M22 12h-6l-2 3H10l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
  }
}

type SearchParams = Promise<{
  insurer?: string | string[];
  status?: string | string[];
  client?: string | string[];
  from?: string | string[];
  to?: string | string[];
  classification?: string | string[];
  view?: string | string[];
}>;

type InboxEmail = {
  id: string;
  toInbox: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  status: keyof typeof statusLabels;
  classification: string;
  insurerLabel?: string | null;
  receivedAt: Date;
  gmailMessageId: string | null;
  aiAnalysis: unknown;
  patient?: { insurer: string } | null;
};

type InboxFilters = {
  insurer: string;
  status: string;
  client: string;
  from: string;
  to: string;
  classification: string;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function buildWhere(
  { insurer, status, client, from, to, classification }: InboxFilters,
  useEmailInsurerLabel: boolean,
): Prisma.EmailWhereInput {
  const where: Prisma.EmailWhereInput = {};

  if (
    classification &&
    classifications.includes(classification as Classification)
  ) {
    where.classification = classification as Classification;
  }

  if (insurer) {
    if (useEmailInsurerLabel) {
      where.insurerLabel = insurer;
    } else {
      where.patient = { is: { insurer } };
    }
  }
  if (statuses.includes(status as (typeof statuses)[number])) {
    where.status = status as (typeof statuses)[number];
  }
  if (client) {
    const clientTerms = client.trim().split(/\s+/).filter(Boolean);
    where.OR = [
      { fromName: { contains: client, mode: "insensitive" } },
      {
        patient: {
          is: {
            AND: clientTerms.map((namePart) => ({
              OR: [
                { firstName: { contains: namePart, mode: "insensitive" } },
                { lastName: { contains: namePart, mode: "insensitive" } },
              ],
            })),
          },
        },
      },
    ];
  }
  if (validDate(from) || validDate(to)) {
    where.receivedAt = {
      ...(validDate(from) ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(validDate(to) ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
  }

  return where;
}

function isMissingInsurerLabelColumn(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2022"
  );
}

async function loadFolderCounts(): Promise<Record<Classification, number>> {
  const counts: Record<Classification, number> = {
    AUTHORIZATION: 0,
    CLAIM: 0,
    REFERRAL: 0,
    SCHEDULING: 0,
    BILLING: 0,
    GENERAL: 0,
  };

  try {
    const rows = await prisma.email.groupBy({
      by: ["classification"],
      where: {
        status: "NEEDS_ACTION",
        classification: { in: [...classifications] },
      },
      _count: { id: true },
    });

    for (const row of rows) {
      const key = row.classification as Classification;
      if (key in counts) {
        counts[key] = row._count.id;
      }
    }
  } catch {
    // Return zeroed counts if the query fails (e.g. migration not yet run)
  }

  return counts;
}

async function loadInbox(filters: InboxFilters) {
  try {
    const [emails, insurerRows] = await Promise.all([
      prisma.email.findMany({
        where: buildWhere(filters, true),
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          toInbox: true,
          fromName: true,
          fromEmail: true,
          subject: true,
          body: true,
          status: true,
          classification: true,
          insurerLabel: true,
          receivedAt: true,
          gmailMessageId: true,
          aiAnalysis: true,
          patient: { select: { insurer: true } },
        },
      }),
      prisma.email.findMany({
        where: { insurerLabel: { not: null } },
        distinct: ["insurerLabel"],
        orderBy: { insurerLabel: "asc" },
        select: { insurerLabel: true },
      }),
    ]);

    return {
      emails: emails as InboxEmail[],
      insurers: insurerRows.flatMap((email) =>
        email.insurerLabel ? [email.insurerLabel] : [],
      ),
    };
  } catch (error) {
    if (!isMissingInsurerLabelColumn(error)) throw error;

    const [emails, patients] = await Promise.all([
      prisma.email.findMany({
        where: buildWhere(filters, false),
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          toInbox: true,
          fromName: true,
          fromEmail: true,
          subject: true,
          body: true,
          status: true,
          classification: true,
          receivedAt: true,
          gmailMessageId: true,
          aiAnalysis: true,
          patient: { select: { insurer: true } },
        },
      }),
      prisma.patient.findMany({
        distinct: ["insurer"],
        orderBy: { insurer: "asc" },
        select: { insurer: true },
      }),
    ]);

    return {
      emails: emails as InboxEmail[],
      insurers: patients.map((patient) => patient.insurer),
    };
  }
}

export default async function EmailInboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  const params = await searchParams;
  const insurer = firstValue(params.insurer) ?? "";
  const selectedStatus = firstValue(params.status) ?? "";
  const client = firstValue(params.client) ?? "";
  const from = firstValue(params.from) ?? "";
  const to = firstValue(params.to) ?? "";
  const rawClassification = firstValue(params.classification) ?? "";
  const view = firstValue(params.view) ?? "";

  const selectedClassification = classifications.includes(
    rawClassification as Classification,
  )
    ? (rawClassification as Classification)
    : null;

  // Folder grid is shown when no classification is selected and not in "view all" mode
  const isFolderGrid = !selectedClassification && view !== "all";

  const [folderCounts, listData] = await Promise.all([
    loadFolderCounts(),
    isFolderGrid
      ? Promise.resolve({ emails: [] as InboxEmail[], insurers: [] as string[] })
      : loadInbox({
          insurer,
          status: selectedStatus,
          client,
          from,
          to,
          classification: selectedClassification ?? "",
        }),
  ]);

  const { emails, insurers } = listData;

  // Build the "clear filters" URL preserving folder context
  const clearHref = selectedClassification
    ? `/email?classification=${selectedClassification}`
    : "/email?view=all";

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a5138]">
          Email service
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#4a3327]">
              {selectedClassification
                ? classificationLabels[selectedClassification]
                : "Clinic inbox"}
            </h2>
            <p className="mt-1 text-sm text-[#765d4e]">
              {selectedClassification
                ? `Viewing ${classificationLabels[selectedClassification].toLowerCase()} messages.`
                : view === "all"
                  ? "All clinic messages across every category."
                  : "Review synthetic clinic messages and route staff work to the appropriate follow-up."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isFolderGrid && (
              <p className="rounded-full bg-[#8d6248]/10 px-3 py-1.5 text-sm font-medium text-[#7a5138]">
                {emails.length} {emails.length === 1 ? "message" : "messages"}
              </p>
            )}

            {/* View all email button — always visible in folder grid and folder-filtered views */}
            {(isFolderGrid || selectedClassification) && (
              <Link
                href="/email?view=all"
                className="rounded-lg border border-[#d8c9ba] px-4 py-2 text-sm font-medium text-[#765d4e] transition hover:border-[#9b6a4b] hover:text-[#7a5138]"
              >
                View all email
              </Link>
            )}

            {/* When in view=all, offer a path back to folders */}
            {view === "all" && !selectedClassification && (
              <Link
                href="/email"
                className="rounded-lg border border-[#d8c9ba] px-4 py-2 text-sm font-medium text-[#765d4e] transition hover:border-[#9b6a4b] hover:text-[#7a5138]"
              >
                ← Folders
              </Link>
            )}

            {/* Back to folders when inside a folder's filtered list */}
            {selectedClassification && (
              <Link
                href="/email"
                className="rounded-lg bg-[#9b6a4b] px-4 py-2 text-sm font-medium text-[#fffaf2] transition hover:bg-[#7a5138]"
              >
                ← Folders
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Folder grid ──────────────────────────────────────────────── */}
      {isFolderGrid && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classifications.map((cls) => {
            const count = folderCounts[cls];
            const colors = classificationColors[cls];

            return (
              <Link
                key={cls}
                href={`/email?classification=${cls}`}
                className={`group relative flex flex-col gap-4 rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm transition ${colors.card} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6a4b]`}
              >
                {/* Urgent count badge */}
                {count > 0 && (
                  <span
                    aria-label={`${count} urgent`}
                    className="absolute right-3 top-3 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-xs font-bold text-white shadow-sm"
                  >
                    {count}
                  </span>
                )}

                <div
                  className={`inline-flex size-12 items-center justify-center rounded-xl ${colors.icon}`}
                >
                  <FolderIcon classification={cls} />
                </div>

                <div>
                  <h3 className="text-base font-semibold text-[#3f2b20] group-hover:text-[#7a5138]">
                    {classificationLabels[cls]}
                  </h3>
                  {count > 0 ? (
                    <p className="mt-0.5 text-xs font-medium text-rose-600">
                      {count} {count === 1 ? "message" : "messages"} need
                      {count === 1 ? "s" : ""} action
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-[#9b8070]">
                      No urgent messages
                    </p>
                  )}
                </div>

                <span className="mt-auto flex items-center gap-1 text-xs font-medium text-[#7a5138] opacity-0 transition-opacity group-hover:opacity-100">
                  Open folder →
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── List view (folder-filtered or view=all) ───────────────────── */}
      {!isFolderGrid && (
        <>
          <details className="group rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-semibold text-[#4a3327] marker:content-none sm:px-5">
              <span>Filter inbox</span>
              <span className="flex items-center gap-2 text-xs font-medium text-[#765d4e]">
                Insurer, status, client, date
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </summary>

            <form
              className="grid gap-4 border-t border-[#e8d9cc] p-4 sm:grid-cols-2 lg:grid-cols-6 sm:px-5"
              action="/email"
            >
              {/* Preserve classification context across filter submissions */}
              {selectedClassification && (
                <input
                  type="hidden"
                  name="classification"
                  value={selectedClassification}
                />
              )}
              {view === "all" && !selectedClassification && (
                <input type="hidden" name="view" value="all" />
              )}

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[#5f4538]">
                Client name
                <input
                  type="search"
                  name="client"
                  defaultValue={client}
                  placeholder="Name or sender"
                  className="rounded-lg border border-[#d8c9ba] bg-white px-3 py-2 text-sm text-[#513a2e] outline-none placeholder:text-[#a99384] focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/20"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[#5f4538]">
                Insurer
                <select
                  name="insurer"
                  defaultValue={insurer}
                  className="rounded-lg border border-[#d8c9ba] bg-white px-3 py-2 text-sm text-[#513a2e] outline-none focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/20"
                >
                  <option value="">All insurers</option>
                  {insurers.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[#5f4538]">
                Status
                <select
                  name="status"
                  defaultValue={selectedStatus}
                  className="rounded-lg border border-[#d8c9ba] bg-white px-3 py-2 text-sm text-[#513a2e] outline-none focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/20"
                >
                  <option value="">All statuses</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[#5f4538]">
                Received from
                <input
                  type="date"
                  name="from"
                  defaultValue={from}
                  className="rounded-lg border border-[#d8c9ba] bg-white px-3 py-2 text-sm text-[#513a2e] outline-none focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/20"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[#5f4538]">
                Received through
                <input
                  type="date"
                  name="to"
                  defaultValue={to}
                  className="rounded-lg border border-[#d8c9ba] bg-white px-3 py-2 text-sm text-[#513a2e] outline-none focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/20"
                />
              </label>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#9b6a4b] px-4 py-2 text-sm font-medium text-[#fffaf2] transition hover:bg-[#7a5138] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6a4b]"
                >
                  Apply
                </button>
                <Link
                  href={clearHref}
                  className="rounded-lg border border-[#d8c9ba] px-4 py-2 text-sm font-medium text-[#765d4e] transition hover:border-[#9b6a4b] hover:text-[#7a5138]"
                >
                  Clear
                </Link>
              </div>
            </form>
          </details>

          <InboxEmailList
            emails={emails.map((email) => ({
              ...email,
              isSelectable:
                email.gmailMessageId === null && email.aiAnalysis === null,
              isAnalyzed: email.aiAnalysis !== null,
            }))}
            folderLabel={
              selectedClassification
                ? classificationLabels[selectedClassification]
                : undefined
            }
          />
        </>
      )}
    </div>
  );
}
