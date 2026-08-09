"use client";

import { useState } from "react";
import AiDraftLabel from "@/components/AiDraftLabel";

type Props = {
  emailId: string;
  draftResponse: string;
};

export default function AiDraftReply({
  emailId,
  draftResponse,
}: Props) {
  const [translatedDraft, setTranslatedDraft] =
    useState<string | null>(null);

  const [isTranslating, setIsTranslating] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null
  );

  async function handleTranslate() {
    if (translatedDraft) {
      setTranslatedDraft(null);
      return;
    }

    setIsTranslating(true);
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

      setTranslatedDraft(data.body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Translation failed"
      );
    } finally {
      setIsTranslating(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="rounded-xl border border-[#d8c9ba] bg-white/70 p-4">
        <div className="whitespace-pre-wrap text-sm leading-7 text-[#513a2e]">
          {translatedDraft ?? draftResponse}{" "}
          <AiDraftLabel />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleTranslate}
          disabled={isTranslating}
          className="rounded-lg border border-[#d8c9ba] bg-[#fffaf2] px-3 py-2 text-sm font-medium text-[#765d4e] transition hover:border-[#9b6a4b] hover:text-[#7a5138] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTranslating
            ? "Translating..."
            : translatedDraft
              ? "Show English"
              : "Translate to Korean"}
        </button>

        {translatedDraft && (
          <span className="text-xs text-[#9b8070]">
            Korean translation
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}