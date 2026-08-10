# Handoff: Sample Inbox AI — Rate Limit and 400 Recovery

**Status:** Follow-up fix required  
**Feature branch:** `AI_Analysis_Fix`  
**Affected UI:** `/email` → **Analyze inbox**  
**Do not modify:** Gmail import, OAuth, calendar task creation, translation, or email status controls.

---

## 1. Observed failure

Clicking **Analyze inbox** starts `POST /api/email/analyze-sample`, but the batch currently fails before any email results are persisted.

Terminal evidence:

```text
Groq API request failed: 400 Bad Request
AI batch failed. Retrying as smaller groups
Groq rate limit hit. Waiting 5000ms before retry 1/3...
Groq rate limit hit. Waiting 10000ms before retry 2/3...
Groq rate limit hit. Waiting 20000ms before retry 3/3...
POST /api/email/analyze-sample 500
```

There are two independent issues:

1. An initial Groq `400 Bad Request` is occurring. The current error message discards the response body, so the exact Groq validation error is hidden.
2. On non-rate-limit failures, `analyzeEmailBatch()` splits a batch and uses `Promise.all`. That sends split retries concurrently, increasing pressure on Groq and causing/reinforcing `429` rate limits.

---

## 2. Chosen product behavior

Use a **manual, five-email backfill**.

- Staff click **Analyze inbox** on `/email`.
- One click analyzes at most **5** currently un-analyzed seeded emails.
- `analyzeEmails()` retains its internal batch size of **3** and its existing pause between batches.
- Staff may click again after success to process the next five.
- This is intentionally not analyze-on-open/page-load. Do not analyze emails merely because a user views `/email` or `/email/[id]`.

Why this choice:

- It is the smallest and safest change to the existing implementation.
- It bounds Groq usage and request duration.
- It avoids an asynchronous job queue, status tracking, per-email loading UI, and race-management required by analyze-as-you-go.

---

## 3. Required code changes

### A. Reduce the API/UI limit to five

Files:

- `app/api/email/analyze-sample/route.ts`
- `components/email/AnalyzeSampleInboxButton.tsx`

Requirements:

1. Change the server default limit from `50` to `5`.
2. Change the client request body from `{ force: false, limit: 50 }` to `{ force: false, limit: 5 }`.
3. Keep a reasonable server maximum limit for a future explicit caller, but the standard UI flow must always request five.
4. Keep filtering to synthetic inbox data only:
   - `gmailMessageId === null`
   - by default, `aiAnalysis === null`
5. Preserve idempotency. A successfully analyzed row must not be selected by a later default request.
6. Include enough result data for the UI to say either:
   - `Analyzed 5 emails. Analyze again for the next batch.`, or
   - `All sample inbox emails are already analyzed.`

Optional but useful response additions:

```json
{
  "remaining": 17,
  "hasMore": true
}
```

Calculate `remaining` from the synthetic, un-analyzed records after writes complete.

### B. Serialize fallback retries

File:

- `app/(dashboard)/calendar/aiService.ts`

Current problematic pattern:

```ts
const halves = await Promise.all([
  analyzeEmailBatch(emails.slice(0, midpoint), entities),
  analyzeEmailBatch(emails.slice(midpoint), entities),
]);
```

Replace it with sequential work:

```ts
const firstHalf = await analyzeEmailBatch(emails.slice(0, midpoint), entities);
const secondHalf = await analyzeEmailBatch(emails.slice(midpoint), entities);
return [...firstHalf, ...secondHalf];
```

Requirements:

- Do not use unbounded or concurrent fan-out for email analysis retries.
- Preserve result ordering.
- Keep existing 429 retry/backoff behavior.
- Keep the batch size of three and redaction/unredaction pipeline.

### C. Expose safe Groq diagnostic details for 400s

Files:

- `lib/ai/provider.ts`
- optionally `app/(dashboard)/calendar/aiService.ts`

`AIProviderError` already has `responseBody`, but the error message passed up from `callAI()` is only:

```text
Groq API request failed: 400 Bad Request
```

Requirements:

1. Safely parse or truncate the Groq error body before logging it server-side.
2. Do **not** log prompts, raw email bodies, unredacted model output, API keys, or PHI.
3. Include useful provider error data such as Groq’s error `message`, `code`, or `type` when present.
4. Return a human-readable generic UI error (for example, `AI provider rejected the request. Please try again later.`); do not expose provider response bodies to the browser.

The goal is to identify whether the remaining `400` is due to JSON mode/output format, model capability, request parameters, or another provider validation rule.

### D. Keep error responses JSON

Files:

- `app/api/email/analyze-sample/route.ts`
- `components/email/AnalyzeSampleInboxButton.tsx`

The current client should tolerate non-JSON failure responses. Keep that defensive parsing, but ensure all route-controlled errors return `NextResponse.json(...)`.

The UI must show:

- a concise error message;
- the failed count when known;
- no raw Groq details or raw email content.

---

## 4. Non-goals

- Do not add analyze-on-open, analyze-on-page-load, or background processing.
- Do not change `POST /api/import-gmail`.
- Do not create calendar tasks from sample analysis.
- Do not change Prisma schema or seed data.
- Do not remove redaction, unredaction, body truncation, response normalization, or leak scans.
- Do not make parallel requests to Groq for this inbox flow.

---

## 5. Verification checklist

### Automated

- [ ] Update/add a unit test proving split-batch recovery is sequential (not `Promise.all`).
- [ ] Run `npx vitest run lib/ai/__tests__/email-redaction.test.ts`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`; document the existing unrelated `googleEventId` generated-Prisma errors if still present.

### Manual

- [ ] Open `/email`; the button requests at most five emails.
- [ ] A successful run reports `Analyzed 5 emails` and indicates another batch is available when applicable.
- [ ] Open one of those emails; Summary, Details, Client Tags, Recommended Actions, and Draft Reply appear when returned by the model.
- [ ] Click again; the prior five are skipped and the next five are selected.
- [ ] Once complete, the UI says there is nothing left to analyze.
- [ ] Temporarily remove `GROQ_API_KEY`; the route returns JSON and the UI shows a clear error.
- [ ] Trigger a provider failure; server logs contain sanitized provider diagnostics and UI exposes only generic safe text.
- [ ] Gmail refresh, status toggle, translation, and calendar workflows still work unchanged.

---

## 6. Implementation summary

Keep the existing user-triggered batch architecture, but make it small and sequential:

```text
/email
  → Analyze inbox
  → POST /api/email/analyze-sample { limit: 5 }
  → select five synthetic/un-analyzed rows
  → analyzeEmails (internal batches of 3, sequential)
  → sequential fallback retries if a batch fails
  → persist aiSummary, aiDraft, aiAnalysis
  → return counts plus remaining/hasMore
  → router.refresh()
```
