"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AnalyzeResult = {
  success: boolean;
  totalCandidates: number;
  analyzed: number;
  skipped: number;
  failed: number;
  remaining?: number;
  hasMore?: boolean;
  error?: string;
};

type AnalyzeSampleInboxButtonProps = {
  selectedEmailIds?: string[];
  onAnalysisComplete?: () => void;
  selectionMode: boolean;
  onStartSelection: () => void;
};

export default function AnalyzeSampleInboxButton({
  selectedEmailIds = [],
  onAnalysisComplete,
  selectionMode,
  onStartSelection,
}: AnalyzeSampleInboxButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      let data: AnalyzeResult;
      try {
        const res = await fetch("/api/email/analyze-sample", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            selectedEmailIds.length > 0
              ? { force: false, emailIds: selectedEmailIds }
              : { force: false, limit: 5 }
          ),
        });
        const responseText = await res.text();

        try {
          data = JSON.parse(responseText) as AnalyzeResult;
        } catch {
          data = {
            success: false,
            totalCandidates: 0,
            analyzed: 0,
            skipped: 0,
            failed: 0,
            error: res.ok
              ? "Analysis returned an invalid response."
              : `Analysis request failed (${res.status}).`,
          };
        }
      } catch {
        setResult({
          success: false,
          totalCandidates: 0,
          analyzed: 0,
          skipped: 0,
          failed: 0,
          error: "Unable to contact the AI analysis service.",
        });
        return;
      }

      setResult(data);

      if (data.success || data.analyzed > 0) {
        onAnalysisComplete?.();
        router.refresh();
      }
    });
  }

  const isRunning = isPending;

  if (!selectionMode) {
    return (
      <button
        type="button"
        onClick={onStartSelection}
        className="inline-flex items-center gap-2 rounded-lg bg-[#9b6a4b] px-4 py-2 text-sm font-medium text-[#fffaf2] transition hover:bg-[#7a5138] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6a4b]"
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
        Analyze
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isRunning}
        className="rounded-lg bg-[#9b6a4b] px-4 py-2 text-sm font-medium text-[#fffaf2] transition hover:bg-[#7a5138] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6a4b] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning
          ? "Analyzing…"
          : selectedEmailIds.length > 0
            ? `Analyze selected (${selectedEmailIds.length}/3)`
            : "Analyze latest 5"}
      </button>

      {result && !result.success && (
        <p
          role="alert"
          className="max-w-xs rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
        >
          {result.error ?? "Analysis failed."}
          {result.failed > 0
            ? ` (${result.failed} email${result.failed === 1 ? "" : "s"} failed)`
            : ""}
        </p>
      )}

      {result && result.success && result.totalCandidates === 0 && (
        <p
          role="status"
          className="max-w-xs rounded-lg border border-[#d8c9ba] bg-[#fffaf2]/80 px-3 py-2 text-xs text-[#765d4e]"
        >
          All sample inbox emails are already analyzed.
        </p>
      )}

      {result && result.success && result.analyzed > 0 && (
        <p
          role="status"
          className="max-w-xs rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
        >
          Analyzed {result.analyzed} email
          {result.analyzed === 1 ? "" : "s"}.{" "}
          {result.hasMore
            ? "Analyze again for the next batch."
            : "All sample inbox emails are already analyzed."}
        </p>
      )}
    </div>
  );
}
