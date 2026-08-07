import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import EmailStatusToggle from "@/components/email/EmailStatusToggle";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Inbox Message — Dr. Song" };

function formatDate(date: Date) {
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function InboxMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const email = await prisma.email.findUnique({
    where: { id },
    select: {
      toInbox: true,
      fromName: true,
      fromEmail: true,
      subject: true,
      body: true,
      status: true,
      classification: true,
      receivedAt: true,
      patient: { select: { insurer: true } },
    },
  });

  if (!email) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex items-start gap-3">
        <Link
          href="/email"
          className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#d8c9ba] text-[#765d4e] transition hover:border-[#9b6a4b] hover:text-[#7a5138]"
          aria-label="Back to inbox"
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
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a5138]">
            Email service
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#4a3327]">
            Message
          </h2>
        </div>
      </header>

      <article className="rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#e7f0f3] px-2.5 py-1 text-xs font-medium text-[#286985]">
            {email.toInbox.replace("_", " ")}
          </span>
          <span className="rounded-full bg-[#eee1d1] px-2.5 py-1 text-xs font-medium text-[#76513c]">
            {email.patient?.insurer ?? "No insurer"}
          </span>
          <span className="rounded-full bg-[#f4eee7] px-2.5 py-1 text-xs font-medium text-[#765d4e]">
            {email.classification.replace("_", " ")}
          </span>
          <EmailStatusToggle emailId={id} initialStatus={email.status} />
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[#3f2b20]">
          {email.subject}
        </h1>
        <dl className="mt-5 grid gap-3 border-y border-[#e8d9cc] py-4 text-sm sm:grid-cols-[7rem_1fr]">
          <dt className="font-semibold text-[#765d4e]">From</dt>
          <dd className="text-[#513a2e]">
            {email.fromName}{" "}
            <span className="text-[#9b8070]">&lt;{email.fromEmail}&gt;</span>
          </dd>
          <dt className="font-semibold text-[#765d4e]">Received</dt>
          <dd className="text-[#513a2e]">{formatDate(email.receivedAt)}</dd>
        </dl>

        <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-[#513a2e]">{email.body}</p>
      </article>

      <p className="rounded-xl border border-[#d8c9ba] bg-[#fffaf2]/65 px-4 py-3 text-sm leading-6 text-[#765d4e]">
        This inbox route provides the seeded-message handoff. AI summaries, action items,
        draft replies, and translation controls are delivered by the separate EMS detail
        workflow.
      </p>
    </div>
  );
}
