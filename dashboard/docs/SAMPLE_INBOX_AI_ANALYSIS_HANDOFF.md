# Handoff: Sample Inbox — Batch AI Analysis

**Status:** Spec / context only — not implemented  
**Created:** 2026-08-10  
**Owner for implementation:** next agent taking this feature  
**Primary UI surface:** `/email` and `/email/[id]`  
**Chosen approach:** Option B — batch backfill for seeded/sample inbox emails

---

## 1. Goal

Run AI analysis on the **sample (seeded) clinic inbox** emails shown on `/email`, persist results to Prisma, and display them on `/email/[id]`.

Gmail import / OAuth is **out of scope for this handoff**. Do not require Refresh Gmail, `GMAIL_*` env vars, or live Gmail API calls.

### Acceptance criteria

1. Staff can trigger a **batch analyze** action from the inbox UI (or a clearly documented equivalent control) that analyzes sample emails missing AI results.
2. Analysis uses the existing Groq + redaction pipeline (`analyzeEmails`), processing emails in **small batches** (not all in parallel).
3. On success, each analyzed email has `aiAnalysis`, `aiSummary`, and (when applicable) `aiDraft` saved in Prisma.
4. Opening `/email/[id]` shows Summary / Details / Client Tags / Recommended Actions / Draft Reply when data exists.
5. On failure, the UI shows a clear error (count failed / reason). Do not silently leave the inbox unmarked.
6. Re-running the action **skips** emails that already have `aiAnalysis` (idempotent backfill), unless an explicit “force re-analyze” flag is added later.
7. Missing `GROQ_API_KEY` fails with a clear message.

---

## 2. Problem diagnosis (why this is needed)

### What the UI expects

`/email/[id]` reads:

| Field | Used for |
|---|---|
| `email.aiAnalysis` (JSON) | Summary title/details, client tags, recommended actions |
| `email.aiSummary` | Fallback title if `aiAnalysis.summaryTitle` missing |
| `email.aiDraft` | Draft Reply section |

Empty → UI shows: **“AI analysis is not available for this email yet.”**

### What exists today

| Path | Behavior |
|---|---|
| `prisma/seed.ts` | Creates sample emails with **no** `aiSummary` / `aiDraft` / `aiAnalysis` |
| `POST /api/import-gmail` | **Only** place that calls `analyzeEmails()` in production |
| `lib/fetchEmails.js` | Only returns **new** Gmail messages not already in DB |
| Sidebar “Refresh Gmail” | Calls import-gmail — irrelevant for seeded inbox |

**Conclusion:** Sample inbox emails never enter the AI pipeline. That is the product gap. Separately, the Gmail analysis path uses Groq **strict `json_schema`**, which has been observed to fail with the current default model — any reuse of `analyzeEmails` must fix that first or analysis will still fail.

---

## 3. Current code (what to reuse)

| File | Role |
|---|---|
| `app/(dashboard)/email/page.tsx` | Sample inbox list (Prisma) |
| `app/(dashboard)/email/[id]/page.tsx` | Detail page + AI Analysis panel |
| `app/(dashboard)/calendar/aiService.ts` | `analyzeEmails()` — batch size 3, redact → Groq → unredact |
| `app/(dashboard)/calendar/emailService.js` | `createTasksFromAnalysis()` persists `aiAnalysis` + tasks |
| `lib/ai/provider.ts` | Groq `callAI`; default model `openai/gpt-oss-20b` |
| `lib/redaction/*` | PII redaction before model calls |
| `app/api/import-gmail/route.js` | Reference for orchestrating analyze + persist — **do not** call this for sample inbox |
| `prisma/schema.prisma` | `Email.aiAnalysis Json?`, `aiSummary`, `aiDraft` |

### Shape stored in `aiAnalysis`

Written today by `createTasksFromAnalysis`:

```ts
{
  category: "client" | "insurance" | "spam",
  urgency: "high" | "medium" | "low",
  actionRequired: boolean,
  summaryTitle: string,
  summaryDetails: string[],
  clientTags: string[],
  recommendedActions: string[] | null,
  dueDate: string | null,   // YYYY-MM-DD
  dueTime: string | null,   // HH:MM AM/PM
}
```

Detail page type: `AiAnalysis` in `email/[id]/page.tsx`.

### Input shape expected by `analyzeEmails`

```ts
{ id: string; sender: string; subject: string; body: string }
```

Map Prisma rows → this shape. Prefer Prisma `id` (cuid) as `id` for the sample path so persistence can key off Prisma IDs directly. Do **not** require `gmailMessageId`.

---

## 4. Recommended architecture (Option B)

```text
Browser (/email)
  │  click “Analyze inbox” (or similar)
  ▼
POST /api/email/analyze-sample   (new route)
  │  1. Require GROQ_API_KEY (clear 500 if missing)
  │  2. Query Prisma: emails where aiAnalysis IS NULL
  │     (optional query flag: force=true to re-analyze all)
  │  3. Map rows → { id, sender, subject, body }
  │  4. Call analyzeEmails(emails)  // already batches of 3 + 1s pause
  │  5. For each result: update Email
  │       aiSummary, aiDraft, aiAnalysis
  │     Optionally create tasks (reuse createTasksFromAnalysis
  │     only if adapted for Prisma ids — see §6)
  ▼
JSON { success, analyzed, skipped, failed, errors? }
  ▼
Client shows progress/result; refresh inbox / open detail to see AI panel
```

### Why batch (not all-at-once)

- `analyzeEmails` already uses `EMAIL_BATCH_SIZE = 3` and sleeps 1s between batches.
- Groq rate limits (429) are common; parallel fan-out is fragile.
- Seed volume is modest (~40+ emails) — sequential batches are fine for a demo.

Do **not** replace batching with unbounded `Promise.all` over every email.

---

## 5. Required fix inside `analyzeEmails` / `callAI` (blocking)

Current email analysis requests Groq **strict JSON Schema**:

```ts
// aiService.ts — analyzeEmailBatchOnce
jsonSchema: {
  name: "email_analysis",
  strict: true,
  schema: ANALYSIS_SCHEMA,
}
```

Observed failure with default model: Groq `400` / `json_validate_failed` (empty generation).

**Implement before or as part of this feature:**

1. Switch email analysis to `jsonMode: true` (same pattern as `app/api/insurance/autofill/route.ts`), **or** switch `DEFAULT_GROQ_MODEL` / `GROQ_MODEL` to a model that reliably supports strict schema.
2. Keep app-side parse + normalize (already in `analyzeEmailBatchOnce`).
3. Handle both response shapes if needed:
   - `{ emails: [ ... ] }` (schema shape), or
   - bare `[ ... ]` array (prompt historically asked for an array).

Insurance autofill already works with `jsonMode: true` — prefer that path for consistency unless product requires schema mode.

Without this fix, the new sample-inbox endpoint will still return “AI analysis failed.”

---

## 6. Persistence details

### Preferred: dedicated save for sample emails

After `analyzeEmails`, update by Prisma `id`:

```ts
await prisma.email.update({
  where: { id: email.id },
  data: {
    aiSummary: [analysis.summaryTitle, ...(analysis.summaryDetails ?? [])]
      .filter(Boolean)
      .join("\n"), // or title-only like createTasksFromAnalysis — pick one and document
    aiDraft: analysis.draftResponse ?? null,
    aiAnalysis: {
      category: analysis.category,
      urgency: analysis.urgency,
      actionRequired: analysis.actionRequired,
      summaryTitle: analysis.summaryTitle,
      summaryDetails: analysis.summaryDetails ?? [],
      clientTags: analysis.clientTags ?? [],
      recommendedActions: analysis.recommendedActions ?? null,
      dueDate: analysis.dueDate ?? null,
      dueTime: analysis.dueTime ?? null,
    },
  },
});
```

**Important:** Today `/api/import-gmail` step 3 saves only `aiSummary` + `aiDraft`; full `aiAnalysis` is written inside `createTasksFromAnalysis`. For sample inbox, **always write `aiAnalysis`** in the new route (or a shared helper), because the detail UI’s Details / Tags / Actions depend on it.

### Tasks (optional for this handoff)

- Creating calendar tasks from analysis is nice but **not required** for AC above.
- If included: adapt `createTasksFromAnalysis` — it currently assumes Gmail-shaped emails and calls `ensureEmailExists` (requires `gmailMessageId`). Sample emails often have `gmailMessageId: null`. Prefer a Prisma-id-based task creator, or skip tasks for v1.

---

## 7. UI requirements

### Placement

On `/email` (inbox list header area), add a control such as:

- **Analyze inbox** (primary for this feature)

Do **not** reuse Sidebar “Refresh Gmail” for this — keep Gmail deferred.

Match existing warm-neutral inbox styling (`rounded-xl` / `rounded-2xl`, rose for errors).

### Interaction

1. Click → disable button, show “Analyzing…” (and optionally `analyzed/total` if streaming/polling is added later; v1 can be a single long request).
2. Success → toast or inline banner: e.g. `Analyzed 37 emails (3 skipped, already done)`.
3. Failure → `role="alert"` with server `error` / `details`.
4. After success, either `router.refresh()` or soft-reload so list/detail pick up new fields.

### Scope filter (recommended)

Default query: `where: { aiAnalysis: null }`.

Optional later:

- Only emails with `gmailMessageId: null` (strictly seeded / non-Gmail).
- Cap with `?limit=10` for cheaper demos.

Document the chosen filter in the PR.

---

## 8. Suggested API contract

`POST /api/email/analyze-sample`

- **Auth:** none (app-wide still has no AuthN — same as rest of dashboard).
- **Body:** optional `{ "force": false, "limit": 50 }`
- **Success `200`:**

```json
{
  "success": true,
  "totalCandidates": 40,
  "analyzed": 37,
  "skipped": 3,
  "failed": 0,
  "tasksCreated": 0
}
```

- **Failure examples:**
  - `500` — missing `GROQ_API_KEY`, Groq error, JSON parse failure
  - Body always includes `{ "success": false, "error": "<human-readable>" }`

Do not log raw email bodies or field PHI to console beyond existing debug patterns; prefer counts.

---

## 9. Suggested file touch list

New:

- `app/api/email/analyze-sample/route.ts` — query → map → `analyzeEmails` → persist
- (optional) `lib/email/persistAnalysis.ts` — shared write of `aiAnalysis` / summary / draft
- (optional) `components/email/AnalyzeSampleInboxButton.tsx` — client trigger + status

Edit:

- `app/(dashboard)/email/page.tsx` — mount analyze button
- `app/(dashboard)/calendar/aiService.ts` — fix `jsonSchema` → `jsonMode` (or model) for email analysis
- `docs/PROJECT_OVERVIEW.md` — brief note that sample inbox analysis is batch-triggered (after ship)

Avoid:

- Changing Gmail OAuth / `lib/gmail.js` / `import-gmail` for this feature
- Analyzing on every page load (Option A) as the primary mechanism
- Parallelizing all emails at once (Option C)

---

## 10. Implementation plan (ordered)

1. Fix Groq email analysis response format (`jsonMode` / model) and verify one email succeeds via a small script or vitest with mocked/live call.
2. Add `POST /api/email/analyze-sample` that selects emails with null `aiAnalysis`, maps to `analyzeEmails` input, persists full `aiAnalysis`.
3. Add inbox UI button + loading/error/success messaging; `router.refresh()` on success.
4. Manual QA on seeded DB (`npm run db:seed` if needed).
5. Optional: task creation for `actionRequired` emails without depending on Gmail IDs.
6. Update overview doc.

---

## 11. Manual QA checklist

- [ ] After seed, open a sample `/email/[id]` → shows “not available yet.”
- [ ] Click **Analyze inbox** with valid `GROQ_API_KEY` → succeeds; counts look sane.
- [ ] Re-open same message → Summary / Details / Tags / Actions populated; Draft Reply if model returned one.
- [ ] Click Analyze again → mostly skipped; no duplicate thrash.
- [ ] Remove/blank `GROQ_API_KEY` → clear failure message.
- [ ] Sidebar Refresh Gmail still unrelated / not required for this flow.
- [ ] `npm run typecheck` and relevant tests pass (or document pre-existing Prisma client gaps).

---

## 12. Out of scope (unless product expands)

- Live Gmail sync, OAuth token wiring in `lib/gmail.js`
- Analyze-on-open (Option A) as primary
- Full parallel analysis (Option C)
- Translating analysis / draft (existing translate routes can stay as-is)
- AuthN / AuthZ
- Changing seed to pre-bake AI blobs (prefer live Groq so demos exercise the pipeline)

---

## 13. Env / docs

- Required: `GROQ_API_KEY` in `.env.local` (see `.env.example`)
- Optional: `GROQ_MODEL` override
- No new Gmail env vars for this feature

---

## 14. One-paragraph brief for the implementing model

Wire Option B batch AI analysis for the **seeded sample inbox only**: add `POST /api/email/analyze-sample` that loads Prisma emails with null `aiAnalysis`, maps them into `analyzeEmails`, and persists `aiSummary` / `aiDraft` / full `aiAnalysis` by Prisma id. Expose an **Analyze inbox** button on `/email`. Fix the email Groq call to use `jsonMode: true` (or a working model) because strict `json_schema` currently fails. Keep existing batch size behavior; do not depend on Gmail import. Skip already-analyzed emails on re-run. Surface failures clearly in the UI.
