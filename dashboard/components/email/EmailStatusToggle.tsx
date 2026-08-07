"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type EmailStatus = "UNREAD" | "READ" | "NEEDS_ACTION" | "ARCHIVED";

const displayStatus: Record<EmailStatus, string> = {
  UNREAD: "Unread",
  READ: "Resolved",
  NEEDS_ACTION: "Needs action",
  ARCHIVED: "Archived",
};

const statusStyles: Record<EmailStatus, string> = {
  UNREAD: "bg-sky-100 text-sky-800",
  READ: "bg-emerald-100 text-emerald-800",
  NEEDS_ACTION: "bg-rose-100 text-rose-700",
  ARCHIVED: "bg-slate-100 text-slate-700",
};

export default function EmailStatusToggle({
  emailId,
  initialStatus,
}: {
  emailId: string;
  initialStatus: EmailStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isResolved = status === "READ";

  function toggleStatus() {
    const nextStatus: Extract<EmailStatus, "READ" | "NEEDS_ACTION"> = isResolved
      ? "NEEDS_ACTION"
      : "READ";

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/emails/${emailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        setError("Unable to update this message. Please try again.");
        return;
      }

      setStatus(nextStatus);
      router.refresh();
    });
  }

  return (
    <>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}>
        {displayStatus[status]}
      </span>
      <button
        type="button"
        onClick={toggleStatus}
        disabled={isPending}
        className="ml-auto rounded-lg border border-[#d8c9ba] px-3 py-1.5 text-xs font-semibold text-[#765d4e] transition hover:border-[#9b6a4b] hover:text-[#7a5138] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? "Saving…"
          : isResolved
            ? "Mark needs action"
            : "Mark resolved"}
      </button>
      {error && <p className="basis-full text-xs font-medium text-rose-700">{error}</p>}
    </>
  );
}
