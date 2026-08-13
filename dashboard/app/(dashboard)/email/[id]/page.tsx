import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import EmailStatusToggle from "@/components/email/EmailStatusToggle";
import AiDraftLabel from "@/components/AiDraftLabel";
import EmailAnalysisPanel from "@/components/email/EmailAnalysisPanel";
import { prisma } from "@/lib/prisma";
import TranslateEmailButton from "@/components/email/TranslateEmailButton";

export const metadata = {
  title: "Inbox Message — Dr. Song",
};

function formatDate(date: Date) {
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type AiAnalysis = {
  category?: string;
  urgency?: string;
  actionRequired?: boolean;
  summaryTitle?: string;
  summaryDetails?: string[];
  clientTags?: string[];
  recommendedActions?: string[] | null;
  dueDate?: string | null;
  dueTime?: string | null;
};

export default async function InboxMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;

  const email = await prisma.email.findUnique({
    where: {
      id,
    },
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
      aiSummary: true,
      aiDraft: true,
      aiAnalysis: true,
      patient: {
        select: {
          insurer: true,
        },
      },
    },
  });

  if (!email) {
    notFound();
  }

  const analysis =
    (email.aiAnalysis as AiAnalysis | null) ?? null;

  const summaryTitle =
    analysis?.summaryTitle ??
    email.aiSummary ??
    null;

  const summaryDetails =
    analysis?.summaryDetails ?? [];

  const clientTags =
    analysis?.clientTags ?? [];

  const recommendedActions =
    analysis?.recommendedActions ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-4">
        <Link
          href="/email"
          className="text-sm font-medium text-[#765d4e] hover:text-[#7a5138] hover:underline"
        >
          ← Back to inbox
        </Link>

        <span className="text-[#d8c9ba]" aria-hidden="true">·</span>

        <Link
          href={`/email/${id}/metrics`}
          className="text-sm font-medium text-[#286985] hover:text-[#1d526a] hover:underline"
        >
          Rate AI quality
        </Link>
      </div>

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

          <EmailStatusToggle
            emailId={id}
            initialStatus={email.status}
          />
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[#3f2b20]">
          {email.subject}
        </h1>

        <dl className="mt-5 grid gap-3 border-y border-[#e8d9cc] py-4 text-sm sm:grid-cols-[7rem_1fr]">
          <dt className="font-semibold text-[#765d4e]">
            From
          </dt>

          <dd className="text-[#513a2e]">
            {email.fromName}{" "}
            <span className="text-[#9b8070]">
              &lt;{email.fromEmail}&gt;
            </span>
          </dd>

          <dt className="font-semibold text-[#765d4e]">
            Received
          </dt>

          <dd className="text-[#513a2e]">
            {formatDate(email.receivedAt)}
          </dd>
        </dl>

        {summaryTitle ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#765d4e]">
              Summary
            </h2>

            <div className="mt-2 rounded-xl border border-[#d8c9ba] bg-white/70 p-4">
              <p className="text-sm leading-7 text-[#513a2e]">
                {summaryTitle} <AiDraftLabel />
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#765d4e]">
              Original message
            </h2>

            <TranslateEmailButton emailId={email.id} />
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#513a2e]">
            {email.body}
          </p>
        </div>
      </article>

      {/* AI ANALYSIS */}
      <EmailAnalysisPanel
        emailId={email.id}
        gmailMessageId={email.gmailMessageId}
        initialAnalysis={analysis}
        initialSummaryTitle={summaryTitle}
        initialSummaryDetails={summaryDetails}
        initialClientTags={clientTags}
        initialRecommendedActions={recommendedActions}
        initialDraftResponse={email.aiDraft}
      />
    </div>
  );
}