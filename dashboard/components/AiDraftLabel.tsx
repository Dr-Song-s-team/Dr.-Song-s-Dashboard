/**
 * AI Draft Label Component
 *
 * Visual badge indicating content was AI-generated and requires review.
 * Use this on every AI-generated field to meet issue #39 acceptance criteria.
 */
export default function AiDraftLabel() {
  return (
    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800">
      AI draft — review required
    </span>
  );
}
