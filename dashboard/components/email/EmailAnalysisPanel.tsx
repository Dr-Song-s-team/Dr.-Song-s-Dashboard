"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AiDraftLabel from "@/components/AiDraftLabel";

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

type EmailAnalysisPanelProps = {
  emailId: string;
  gmailMessageId: string | null;
  initialAnalysis: AiAnalysis | null;
  initialSummaryTitle: string | null;
  initialSummaryDetails: string[];
  initialClientTags: string[];
  initialRecommendedActions: string[];
  initialDraftResponse: string | null;
};

type AnalysisState = "idle" | "analyzing" | "success" | "error" | "retrying";

export default function EmailAnalysisPanel({
  emailId,
  gmailMessageId,
  initialAnalysis,
  initialSummaryTitle,
  initialSummaryDetails,
  initialClientTags,
  initialRecommendedActions,
  initialDraftResponse,
}: EmailAnalysisPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<AnalysisState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retryDelay, setRetryDelay] = useState<number>(0);
  const hasAnalyzedRef = useRef(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Local state for analysis data (starts with initial, updates after auto-analyze)
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(initialAnalysis);
  const [summaryTitle, setSummaryTitle] = useState(initialSummaryTitle);
  const [summaryDetails, setSummaryDetails] = useState(initialSummaryDetails);
  const [clientTags, setClientTags] = useState(initialClientTags);
  const [recommendedActions, setRecommendedActions] = useState(initialRecommendedActions);
  const [draftResponse, setDraftResponse] = useState(initialDraftResponse);

  // Sync props to state when they change (e.g., after router.refresh())
  useEffect(() => {
    setAnalysis(initialAnalysis);
    setSummaryTitle(initialSummaryTitle);
    setSummaryDetails(initialSummaryDetails);
    setClientTags(initialClientTags);
    setRecommendedActions(initialRecommendedActions);
    setDraftResponse(initialDraftResponse);
  }, [
    initialAnalysis,
    initialSummaryTitle,
    initialSummaryDetails,
    initialClientTags,
    initialRecommendedActions,
    initialDraftResponse,
  ]);

  // Auto-analyze on mount if needed
  useEffect(() => {
    // Guard: only analyze sample emails (gmailMessageId === null) without existing analysis
    if (gmailMessageId !== null || initialAnalysis !== null || hasAnalyzedRef.current) {
      return;
    }

    hasAnalyzedRef.current = true;
    analyzeEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Cleanup retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  async function analyzeEmail(isRetry = false) {
    if (isRetry) {
      setState("retrying");
    } else {
      setState("analyzing");
    }
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const res = await fetch("/api/email/analyze-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 429) {
        // Rate limited - try to parse retry-after hint
        const data = await res.json();
        const retryAfterMatch = data.error?.match(/try again in\s+([\d.]+)s/i);
        const retrySeconds = retryAfterMatch
          ? Math.min(Number(retryAfterMatch[1]), 10)
          : 5;

        setRetryDelay(Math.ceil(retrySeconds));
        setState("retrying");

        // Auto-retry after delay
        retryTimerRef.current = setTimeout(() => {
          setRetryDelay(0);
          analyzeEmail(true);
        }, retrySeconds * 1000);

        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `HTTP ${res.status}`);
        setState("error");
        return;
      }

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Analysis failed");
        setState("error");
        return;
      }

      // Success - update local state immediately with response data
      if (data.analysis) {
        setAnalysis(data.analysis);
        setSummaryTitle(data.analysis.summaryTitle || null);
        setSummaryDetails(data.analysis.summaryDetails || []);
        setClientTags(data.analysis.clientTags || []);
        setRecommendedActions(data.analysis.recommendedActions || []);
        setDraftResponse(data.analysis.draftResponse || null);
      }

      setState("success");
      // Also refresh to update server-rendered parts
      router.refresh();
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error && err.name === "AbortError") {
        setError("Analysis timed out after 15 seconds");
      } else {
        setError("Network error - please check your connection");
      }

      setState("error");
    }
  }

  function handleRetry() {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setRetryDelay(0);
    analyzeEmail(true);
  }

  // Show analyzing state
  if (state === "analyzing") {
    return (
      <section className="rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#3f2b20]">AI Analysis</h2>
            <p className="mt-1 text-sm text-[#765d4e]">
              AI-generated information extracted from this email.
            </p>
          </div>
          <AiDraftLabel />
        </div>

        <div className="mt-6 space-y-4">
          {/* Skeleton for summary */}
          <div className="animate-pulse">
            <div className="h-4 w-24 rounded bg-[#e8d9cc]" />
            <div className="mt-2 h-20 rounded-xl bg-[#e8d9cc]" />
          </div>

          {/* Skeleton for details */}
          <div className="animate-pulse">
            <div className="h-4 w-20 rounded bg-[#e8d9cc]" />
            <div className="mt-2 space-y-2">
              <div className="h-6 rounded bg-[#e8d9cc]" />
              <div className="h-6 rounded bg-[#e8d9cc]" />
              <div className="h-6 rounded bg-[#e8d9cc]" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-[#765d4e]">
            <svg
              className="size-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
            </svg>
            Analyzing email...
          </div>
        </div>
      </section>
    );
  }

  // Show retrying state
  if (state === "retrying") {
    return (
      <section className="rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#3f2b20]">AI Analysis</h2>
            <p className="mt-1 text-sm text-[#765d4e]">
              AI-generated information extracted from this email.
            </p>
          </div>
          <AiDraftLabel />
        </div>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="size-5 shrink-0 text-amber-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {retryDelay > 0
                  ? `AI busy, retrying in ${retryDelay}s...`
                  : "Retrying analysis..."}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Show error state with retry button
  if (state === "error") {
    return (
      <section className="rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#3f2b20]">AI Analysis</h2>
            <p className="mt-1 text-sm text-[#765d4e]">
              AI-generated information extracted from this email.
            </p>
          </div>
          <AiDraftLabel />
        </div>

        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="size-5 shrink-0 text-rose-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6m0-6 6 6" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-rose-800">
                Analysis failed: {error}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
              >
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
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
                Retry
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Show actual analysis (success or initial data)
  const category = analysis?.category;
  const urgency = analysis?.urgency;
  const actionRequired = analysis?.actionRequired;

  return (
    <section className="rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#3f2b20]">AI Analysis</h2>
          <p className="mt-1 text-sm text-[#765d4e]">
            AI-generated information extracted from this email.
          </p>
        </div>
        <AiDraftLabel />
      </div>

      {/* Category, Urgency, Action Required */}
      {(category || urgency || actionRequired !== undefined) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {category && (
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                category === "client"
                  ? "bg-blue-100 text-blue-800"
                  : category === "insurance"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </span>
          )}
          {urgency && (
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                urgency === "high"
                  ? "bg-rose-100 text-rose-800"
                  : urgency === "medium"
                    ? "bg-orange-100 text-orange-800"
                    : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {urgency.charAt(0).toUpperCase() + urgency.slice(1)} Priority
            </span>
          )}
          {actionRequired && (
            <span className="rounded-full bg-violet-100 px-3 py-1.5 text-sm font-medium text-violet-800">
              Action Required
            </span>
          )}
        </div>
      )}

      {summaryDetails.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[#765d4e]">Details</h3>
          <div className="mt-2 rounded-xl border border-[#d8c9ba] bg-white/70 p-4">
            <ul className="space-y-3">
              {summaryDetails.map((detail, index) => (
                <li
                  key={`${detail}-${index}`}
                  className="flex gap-3 text-sm leading-6 text-[#513a2e]"
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#9b6a4b]" />
                  <span>
                    {detail} <AiDraftLabel />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {clientTags.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[#765d4e]">Client Tags</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {clientTags.map((client, index) => (
              <span
                key={`${client}-${index}`}
                className="rounded-full bg-[#eee1d1] px-3 py-1.5 text-sm font-medium text-[#76513c]"
              >
                {client} <AiDraftLabel />
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {recommendedActions && recommendedActions.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[#765d4e]">
            Recommended Actions
          </h3>
          <div className="mt-2 rounded-xl border border-[#d8c9ba] bg-white/70 p-4">
            <ul className="space-y-3">
              {recommendedActions.map((action, index) => (
                <li
                  key={`${action}-${index}`}
                  className="flex items-start gap-3 text-sm leading-6 text-[#513a2e]"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#9b6a4b] text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">
                    {action} <AiDraftLabel />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {draftResponse ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[#765d4e]">Draft Response</h3>
          <div className="mt-2 rounded-xl border border-[#d8c9ba] bg-white/70 p-4">
            <p className="whitespace-pre-wrap text-sm leading-7 text-[#513a2e]">
              {draftResponse} <AiDraftLabel />
            </p>
            <p className="mt-4 text-xs text-[#9b8070]">
              Review and edit this AI-generated response before sending.
            </p>
          </div>
        </div>
      ) : null}

      {/* Only show "not available" if no analysis data exists (state is idle, meaning no auto-analysis ran) */}
      {!summaryTitle &&
      summaryDetails.length === 0 &&
      clientTags.length === 0 &&
      (!recommendedActions || recommendedActions.length === 0) &&
      !draftResponse ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#cbb199] bg-[#fffaf2]/70 p-5 text-center">
          <p className="text-sm text-[#765d4e]">
            {gmailMessageId !== null
              ? "AI analysis is not available for Gmail messages."
              : "AI analysis is not available for this email yet."}
          </p>
        </div>
      ) : null}
    </section>
  );
}
