"use client";

import { useState } from "react";

interface TranslateEmailButtonProps {
  emailId: string;
}

export default function TranslateEmailButton({
  emailId,
}: TranslateEmailButtonProps) {
  const [translated, setTranslated] = useState<{
    summary: string;
    body: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTranslate() {
    if (translated) {
      setTranslated(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/email/${emailId}/translate`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Translation failed"
        );
      }

      setTranslated({
        summary: data.summary,
        body: data.body,
      });
    } catch (error) {
      console.error(
        "Translation failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Translation failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleTranslate}
        disabled={loading}
        className="rounded-lg border border-[#d8c9ba] bg-white px-4 py-2 text-sm font-medium text-[#76513c] hover:bg-[#f4eee7] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Translating..."
          : translated
            ? "Hide Korean Translation"
            : "Translate to Korean"}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {translated && (
        <div className="mt-4 rounded-xl border border-[#d8c9ba] bg-[#f4eee7]/60 p-4">
          <h3 className="text-sm font-semibold text-[#765d4e]">
            Korean Translation
          </h3>

          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#9b8070]">
              Summary
            </h4>

            <p className="mt-2 text-sm leading-7 text-[#513a2e]">
              {translated.summary}
            </p>
          </div>

          <div className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#9b8070]">
              Message
            </h4>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#513a2e]">
              {translated.body}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}