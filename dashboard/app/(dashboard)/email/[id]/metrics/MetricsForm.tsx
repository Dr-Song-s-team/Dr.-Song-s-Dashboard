"use client";

import { useState } from "react";
import Link from "next/link";

interface MetricsFormProps {
  emailId: string;
  emailSubject: string;
}

type ScoreValue = 1 | 2 | 3 | 4 | 5;

const SCORE_LABELS: Record<ScoreValue, string> = {
  1: "Not at all",
  2: "Slightly",
  3: "Moderately",
  4: "Very",
  5: "Extremely",
};

function ScoreSelector({
  id,
  label,
  description,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  value: ScoreValue | null;
  onChange: (v: ScoreValue) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-[#3f2b20]">
        {label}
      </legend>
      <p className="text-xs text-[#765d4e]">{description}</p>
      <div className="flex items-center gap-3" role="group" aria-label={label}>
        {([1, 2, 3, 4, 5] as ScoreValue[]).map((score) => {
          const selected = value === score;
          return (
            <label key={score} className="flex flex-col items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name={id}
                value={score}
                checked={selected}
                onChange={() => onChange(score)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex size-11 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all select-none ${
                  selected
                    ? "border-[#286985] bg-[#286985] text-white shadow-md"
                    : "border-[#d8c9ba] bg-white text-[#765d4e] hover:border-[#286985]/60 hover:bg-[#e7f0f3]"
                }`}
              >
                {score}
              </span>
              <span className="text-[10px] text-[#9b8070] text-center w-12 leading-tight">
                {SCORE_LABELS[score]}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function MetricsForm({ emailId, emailSubject }: MetricsFormProps) {
  const [analysisUsefulness, setAnalysisUsefulness] = useState<ScoreValue | null>(null);
  const [koreanTranslationAccuracy, setKoreanTranslationAccuracy] = useState<ScoreValue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (analysisUsefulness === null || koreanTranslationAccuracy === null) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/email/${emailId}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisUsefulness, koreanTranslationAccuracy }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Submission failed.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-8 shadow-sm text-center space-y-4">
        <div className="text-3xl" aria-hidden="true">✓</div>
        <h2 className="text-lg font-semibold text-[#3f2b20]">Thank you for your feedback!</h2>
        <p className="text-sm text-[#765d4e]">
          Your ratings help us improve the quality of AI-generated content.
        </p>
        <Link
          href={`/email/${emailId}`}
          className="inline-block mt-2 text-sm font-medium text-[#286985] hover:underline"
        >
          ← Back to email
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <div className="rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm sm:p-7 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-[#3f2b20]">Rate AI Quality</h2>
          <p className="mt-1 text-sm text-[#765d4e]">
            Share your feedback on the AI output for:{" "}
            <span className="font-medium text-[#513a2e]">{emailSubject}</span>
          </p>
          <p className="mt-2 text-xs text-[#9b8070]">
            1 = Not at all useful/accurate &nbsp;·&nbsp; 5 = Extremely useful/accurate
          </p>
        </div>

        <div className="space-y-8">
          <ScoreSelector
            id="analysisUsefulness"
            label="How useful was the AI analysis?"
            description="Rate the overall usefulness of the AI-generated summary, details, and recommended actions."
            value={analysisUsefulness}
            onChange={setAnalysisUsefulness}
          />

          <ScoreSelector
            id="koreanTranslationAccuracy"
            label="How accurate was the Korean translation?"
            description="Rate the accuracy and naturalness of the Korean translation provided for this email."
            value={koreanTranslationAccuracy}
            onChange={setKoreanTranslationAccuracy}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={submitting || analysisUsefulness === null || koreanTranslationAccuracy === null}
            className="rounded-lg bg-[#286985] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#1d526a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Ratings"}
          </button>

          {(analysisUsefulness === null || koreanTranslationAccuracy === null) && (
            <p className="text-xs text-[#9b8070]">
              Please select a score for both questions.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
