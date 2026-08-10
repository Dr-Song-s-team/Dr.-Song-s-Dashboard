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

type SearchParams = Promise<{
  insurer?: string | string[];
  status?: string | string[];
  client?: string | string[];
  from?: string | string[];
  to?: string | string[];
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
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function buildWhere(
  { insurer, status, client, from, to }: InboxFilters,
  useEmailInsurerLabel: boolean,
): Prisma.EmailWhereInput {
  const where: Prisma.EmailWhereInput = {};

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
  const { emails, insurers } = await loadInbox({
    insurer,
    status: selectedStatus,
    client,
    from,
    to,
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a5138]">
          Email service
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#4a3327]">
              Clinic inbox
            </h2>
            <p className="mt-1 text-sm text-[#765d4e]">
              Review synthetic clinic messages and route staff work to the appropriate
              follow-up.
            </p>
          </div>
          <p className="rounded-full bg-[#8d6248]/10 px-3 py-1.5 text-sm font-medium text-[#7a5138]">
            {emails.length} {emails.length === 1 ? "message" : "messages"}
          </p>
        </div>
      </header>

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
              href="/email"
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
      />
    </div>
  );
}
