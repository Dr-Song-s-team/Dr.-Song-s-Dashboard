"use client";

import Link from "next/link";
import { useState } from "react";
import AnalyzeSampleInboxButton from "./AnalyzeSampleInboxButton";

const MAX_SELECTED_EMAILS = 3;

const statusLabels = {
  UNREAD: "Unread",
  READ: "Read",
  NEEDS_ACTION: "Needs action",
  ARCHIVED: "Archived",
} as const;

const statusStyles = {
  UNREAD: "bg-sky-100 text-sky-800",
  READ: "bg-stone-100 text-stone-700",
  NEEDS_ACTION: "bg-rose-100 text-rose-700",
  ARCHIVED: "bg-slate-100 text-slate-700",
} as const;

type InboxEmail = {
  id: string;
  toInbox: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  status: keyof typeof statusLabels;
  receivedAt: Date;
  isSelectable: boolean;
  isAnalyzed: boolean;
};

type InboxEmailListProps = {
  emails: InboxEmail[];
  /** When set, the empty-state message references this folder label. */
  folderLabel?: string;
};

function formatDate(date: Date) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function preview(body: string) {
  const normalized = body.replace(/\s+/g, " ").trim();
  return normalized.length > 170 ? `${normalized.slice(0, 167)}…` : normalized;
}

export default function InboxEmailList({ emails, folderLabel }: InboxEmailListProps) {
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  function toggleSelection(emailId: string) {
    setSelectedEmailIds((selectedIds) => {
      if (selectedIds.includes(emailId)) {
        return selectedIds.filter((id) => id !== emailId);
      }

      if (selectedIds.length >= MAX_SELECTED_EMAILS) {
        return selectedIds;
      }

      return [...selectedIds, emailId];
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {selectionMode ? (
          <p className="text-sm text-[#765d4e]">
            Select up to {MAX_SELECTED_EMAILS} un-analyzed sample emails, or analyze
            the latest five automatically.
          </p>
        ) : (
          <span />
        )}
        <AnalyzeSampleInboxButton
          selectedEmailIds={selectedEmailIds}
          selectionMode={selectionMode}
          onStartSelection={() => setSelectionMode(true)}
          onAnalysisComplete={() => {
            setSelectedEmailIds([]);
            setSelectionMode(false);
          }}
        />
      </div>

      {emails.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#cbb199] bg-[#fffaf2]/70 px-6 py-12 text-center">
          <h3 className="text-lg font-semibold text-[#4a3327]">
            No messages match these filters
          </h3>
          <p className="mt-2 text-sm text-[#765d4e]">
            {folderLabel
              ? `No ${folderLabel.toLowerCase()} messages match your current filters. Try adjusting or clearing a filter.`
              : "Adjust or clear a filter to view the seeded clinic inbox."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 shadow-sm">
          <ul className="divide-y divide-[#e8d9cc]">
            {emails.map((email) => {
              const isSelected = selectedEmailIds.includes(email.id);
              const selectionLimitReached =
                selectedEmailIds.length >= MAX_SELECTED_EMAILS && !isSelected;

              return (
                <li key={email.id} className="flex items-stretch">
                  {selectionMode && email.isSelectable && (
                    <label className="flex shrink-0 items-start px-4 pt-5 sm:px-5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={selectionLimitReached}
                        onChange={() => toggleSelection(email.id)}
                        aria-label={`Select ${email.subject} for AI analysis`}
                        className="mt-1 size-4 rounded border-[#b99b86] text-[#9b6a4b] focus:ring-[#9b6a4b] disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </label>
                  )}
                  <Link
                    href={`/email/${email.id}`}
                    className="group block min-w-0 flex-1 px-4 py-4 transition hover:bg-[#f7eee4] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#9b6a4b] sm:px-5"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={`truncate text-sm ${
                              email.status === "UNREAD"
                                ? "font-semibold text-[#3f2b20]"
                                : "font-medium text-[#5f4538]"
                            }`}
                          >
                            {email.fromName}
                          </p>
                          <span className="text-xs text-[#9b8070]">
                            {email.fromEmail}
                          </span>
                        </div>
                        <h3
                          className={`mt-1 truncate text-base ${
                            email.status === "UNREAD"
                              ? "font-semibold text-[#3f2b20]"
                              : "font-medium text-[#513a2e]"
                          }`}
                        >
                          {email.subject}
                        </h3>
                        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[#765d4e]">
                          {preview(email.body)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                        {email.isAnalyzed && (
                          <span
                            title="AI analyzed"
                            aria-label="AI analyzed"
                            className="inline-flex size-7 items-center justify-center rounded-full bg-violet-100 text-violet-700"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="size-4"
                              aria-hidden="true"
                            >
                              <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" />
                              <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
                            </svg>
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            statusStyles[email.status]
                          }`}
                        >
                          {statusLabels[email.status]}
                        </span>
                        <span className="rounded-full bg-[#e7f0f3] px-2.5 py-1 text-xs font-medium text-[#286985]">
                          {email.toInbox.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-[#9b8070]">
                      Received {formatDate(email.receivedAt)}
                      <span className="ml-2 font-medium text-[#7a5138] group-hover:underline">
                        Open message →
                      </span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
