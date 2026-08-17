"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deletePatient, type ActionState } from "../actions";

const COUNTDOWN_SECONDS = 3;
const initialState: ActionState = {};

interface Props {
  patientId: string;
  patientName: string;
}

export default function DeletePatientDialog({ patientId, patientName }: Props) {
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [confirmValue, setConfirmValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const deleteWithId = deletePatient.bind(null, patientId);
  const [state, formAction, isPending] = useActionState(deleteWithId, initialState);

  const countdownComplete = countdown === 0;
  const nameMatches = confirmValue.trim().replace(/\s+/g, " ") === patientName.trim().replace(/\s+/g, " ");

  function openDialog() {
    setOpen(true);
    setCountdown(COUNTDOWN_SECONDS);
    setConfirmValue("");
  }

  function closeDialog() {
    setOpen(false);
    setConfirmValue("");
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => {
    if (!open) return;

    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (countdownComplete && open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [countdownComplete, open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-5 py-2.5 text-sm font-medium text-rose-700 transition hover:border-rose-400 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
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
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
        Permanently Remove
      </button>
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!isPending ? closeDialog : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-[2rem] border border-rose-200 bg-[#fffaf2] p-8 shadow-[0_24px_70px_rgba(93,63,44,0.18)]">
        {/* Warning icon */}
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-rose-100">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6 text-rose-600"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2
          id="delete-dialog-title"
          className="mb-2 text-lg font-semibold text-[#4a3327]"
        >
          Permanently remove patient
        </h2>
        <p
          id="delete-dialog-desc"
          className="mb-6 text-sm leading-relaxed text-[#765d4e]"
        >
          This action is <strong className="text-rose-700">irreversible</strong>.
          The patient record for{" "}
          <strong className="text-[#4a3327]">{patientName}</strong> will be
          permanently deleted from the database. Associated documents and emails
          will be preserved but unlinked.
        </p>

        {/* Countdown phase */}
        {!countdownComplete && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-800"
              aria-live="polite"
              aria-atomic="true"
            >
              {countdown}
            </span>
            <p className="text-sm text-amber-800">
              Please wait before confirming…
            </p>
          </div>
        )}

        {/* Confirmation input — visible only after countdown */}
        {countdownComplete && (
          <form action={formAction} noValidate>
            <input type="hidden" name="confirmName" value={confirmValue} />

            <div className="mb-6">
              <label
                htmlFor="delete-confirm-input"
                className="mb-2 block text-sm font-medium text-[#4a3327]"
              >
                Type{" "}
                <span className="font-semibold text-rose-700">
                  {patientName}
                </span>{" "}
                to confirm:
              </label>
              <input
                id="delete-confirm-input"
                ref={inputRef}
                type="text"
                autoComplete="off"
                value={confirmValue}
                onChange={(e) => setConfirmValue(e.currentTarget.value)}
                disabled={isPending}
                placeholder={patientName}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#513a2e] placeholder-[#9b8070] outline-none transition focus:ring-2 ${
                  confirmValue.length > 0 && !nameMatches
                    ? "border-rose-400 bg-rose-50/50 focus:border-rose-400 focus:ring-rose-400/40"
                    : nameMatches
                      ? "border-emerald-400 bg-emerald-50/30 focus:border-emerald-500 focus:ring-emerald-400/40"
                      : "border-[#d8c9ba] bg-white/70 focus:border-[#9b6a4b] focus:ring-[#9b6a4b]/40"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              />
              {confirmValue.length > 0 && !nameMatches && (
                <p className="mt-1.5 text-xs text-rose-600" role="alert">
                  Name does not match — check spelling and capitalization.
                </p>
              )}
            </div>

            {state.message && (
              <div
                className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                role="alert"
              >
                {state.message}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeDialog}
                disabled={isPending}
                className="rounded-xl border border-[#d8c9ba] px-5 py-2.5 text-sm font-medium text-[#513a2e] transition hover:bg-[#f0e6d8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!nameMatches || isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
              >
                {isPending ? (
                  <>
                    <svg
                      className="size-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Deleting…
                  </>
                ) : (
                  "Confirm Deletion"
                )}
              </button>
            </div>
          </form>
        )}

        {/* Cancel button while countdown is running */}
        {!countdownComplete && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-xl border border-[#d8c9ba] px-5 py-2.5 text-sm font-medium text-[#513a2e] transition hover:bg-[#f0e6d8]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
