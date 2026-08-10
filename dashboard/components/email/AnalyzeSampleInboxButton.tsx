"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AnalyzeResult = {
  success: boolean;
  totalCandidates: number;
  analyzed: number;
  skipped: number;
  failed: number;
  error?: string;
  details?: string;
  errors?: string[];
};

export default function AnalyzeSampleInboxButton() {
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
          body: JSON.stringify({ force: false, limit: 50 }),
        });
        data = await res.json();
      } catch (err) {
        setResult({
          success: false,
          totalCandidates: 0,
          analyzed: 0,
          skipped: 0,
          failed: 0,
          error: err instanceof Error ? err.message : "Request failed.",
        });
        return;
      }

      setResult(data);

      if (data.success || data.analyzed > 0) {
        router.refresh();
      }
    });
  }

  const isRunning = isPending;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isRunning}
        className="rounded-lg bg-[#9b6a4b] px-4 py-2 text-sm font-medium text-[#fffaf2] transition hover:bg-[#7a5138] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6a4b] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning ? "Analyzing…" : "Analyze inbox"}
      </button>

      {result && !result.success && (
        <p
          role="alert"
          className="max-w-xs rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
        >
          {result.error ?? "Analysis failed."}
          {result.details ? ` ${result.details}` : ""}
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
          All emails already analyzed — nothing to do.
        </p>
      )}

      {result && result.success && result.analyzed > 0 && (
        <p
          role="status"
          className="max-w-xs rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
        >
          Analyzed {result.analyzed} email
          {result.analyzed === 1 ? "" : "s"}
          {result.skipped > 0
            ? ` (${result.skipped} already done)`
            : ""}
          .
        </p>
      )}
    </div>
  );
}
