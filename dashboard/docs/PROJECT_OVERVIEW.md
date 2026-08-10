# Dr. Song's Dashboard — Project Overview

**Repository state reviewed:** `main` at `bcf91d0` (merged PR #31)  
**Review date:** 2026-08-05  
**Purpose:** onboarding reference for understanding the application, its data paths, its architecture, and what is implemented today.

## 1. What this project is

Dr. Song's Dashboard is a Next.js clinic-operations prototype for an acupuncture practice. It combines:

- patient record management;
- an insurance-form workflow for CMS-1500, ASH medical-necessity, and personal-injury forms;
- a task/calendar interface;
- an in-progress email-analysis and scheduling workflow; and
- a Groq-backed AI layer designed to redact patient-identifying information before model calls.

The repository deliberately seeds only synthetic data. It is not yet a complete production clinic system: authentication, access controls, durable inbound email integration, PDF generation, and an operational deployment configuration are absent.

## 2. Technology and runtime

- **Application framework:** Next.js 16 App Router, React 19, TypeScript (strict mode).
- **Styling:** Tailwind CSS 4 plus component-local CSS for the calendar.
- **Database:** PostgreSQL through Prisma 7 and the `@prisma/adapter-pg` driver adapter.
- **Database hosting convention:** Neon-compatible pooled `DATABASE_URL` for the app and direct `DIRECT_URL` for migrations.
- **AI provider:** Groq's OpenAI-compatible chat-completions API. Default model: `llama-3.3-70b-versatile`; overridable with `GROQ_MODEL`.
- **Testing:** Node's built-in test runner is currently the default `npm test`; Vitest is installed and contains the redaction/provider suites.
- **Other installed dependencies:** Google APIs, Express, CORS, CSV parsing, JWT utilities, and holiday support. Several of these are not wired into the observed Next.js application path.

## 3. How to run it locally

1. Copy `.env.example` to `.env.local`.
2. Set:
   - `DATABASE_URL`: the runtime PostgreSQL URL (Neon pooled URL when using Neon).
   - `DIRECT_URL`: a direct PostgreSQL URL for migrations.
   - `GROQ_API_KEY`: required only for AI features.
3. Generate the Prisma client if post-install has not done so:

   ```bash
   npm run db:generate
   ```

4. Apply migrations, then load the deterministic fictional sample dataset:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Start the Next.js application:

   ```bash
   npm run dev
   ```

`lib/env.ts` produces useful setup errors when required environment variables are missing. `prisma/seed.ts` deletes existing tasks, emails, and documents before recreating its synthetic fixture data; it is intended for development only.

## 4. Repository map

```text
app/
  (dashboard)/              Dashboard route group and shared sidebar layout
    info/                   Patient list, intake, detail, and editing flows
    insurance/              Template selection and editable insurance forms
    calendar/               Calendar UI plus mock email-analysis code
  api/
    events/                 Task CRUD, completion, and archiving endpoints
    insurance/              AI autofill and draft-form saving endpoints
  generated/prisma/         Generated Prisma client (not source of truth)
components/
  Sidebar.tsx               Global navigation
lib/
  ai/                       Groq client wrapper and provider tests
  redaction/                PII detection, redaction, unredaction, leak scan
  insurance/templates.ts    Form schemas and field metadata
  prisma.ts                 Shared Prisma client
  validatePatient.ts        Patient form validation/normalization
prisma/
  schema.prisma             Database schema
  seed.ts                   Synthetic fixture data
public/fixtures/documents/  PDF fixtures referenced by seeded documents
index.js                    Express email/schedule-analysis sidecar (port 3001)
docs/
  PROJECT_OVERVIEW.md       This document
```

## 5. Application architecture

### Rendering and navigation

The root layout (`app/layout.tsx`) establishes fonts and global CSS. All primary UI routes live in the `(dashboard)` route group, whose layout adds `Sidebar.tsx` and the common application shell.

The sidebar exposes these destinations:

- `/` — currently a welcome panel, despite being labeled “Email.”
- `/calendar` — task/calendar interface.
- `/info` — patient administration.
- `/insurance` — insurance form creation.
- `/forms` — linked by the sidebar but not implemented in the checked route tree.

Pages that directly query Prisma are Server Components. Interactive forms and calendar screens are Client Components. Patient writes use Next.js Server Actions, while calendar and insurance interactions call route handlers with `fetch`.

### Backend boundaries

```text
Browser
  ├─ Server-rendered pages ───────────────► Prisma ─► PostgreSQL
  ├─ Patient form Server Actions ─────────► Prisma ─► PostgreSQL
  ├─ Calendar fetches ────────────────────► /api/events ─► Prisma ─► PostgreSQL
  └─ Insurance form fetches
       ├─ /api/insurance/save ────────────► Prisma ─► PostgreSQL
       └─ /api/insurance/autofill
            ├─ Prisma reads patient, documents, emails
            ├─ PII redaction
            ├─ Groq API call with redacted prompt
            ├─ token-based unredaction and PII scan
            └─ JSON fields returned to browser for review
```

The calendar page also polls `http://localhost:3001/api/emails`, `/api/schedule`, and `/api/refresh`. A separate Express sidecar is implemented in root-level `index.js`, but it is not started by any `package.json` script and therefore does not run with `npm run dev`. It currently has a broken CSV path (see [Known gaps and risks](#11-known-gaps-and-risks)), so this integration is not functional as checked.

## 6. Data model

The Prisma schema has five models:

- **Patient** — identity/contact data, insurance carrier/member ID, authorization visit limit and usage, and free-form status notes. Email is unique.
- **Document** — a patient-associated form/report with a type, workflow status, title, fixture PDF path, and optional notes.
- **Email** — an inbox message with source inbox, sender/body, reading status, classification, optional AI summary/draft, and an optional patient relation.
- **Task** — a calendar item with title, description, due date, status, and optional patient/email source relations.
- **Reminder** — a scheduled reminder belonging to a task; it is cascade-deleted with its task.

The primary relationships are:

```text
Patient 1 ── * Document
Patient 1 ── * Email
Patient 1 ── * Task
Email   1 ── * Task
Task    1 ── * Reminder
```

Document types include three older intake forms, SOAP notes, and the three new insurance form types. Document statuses are `DRAFT`, `PENDING_REVIEW`, `APPROVED`, and `REJECTED`; task statuses are `PENDING`, `COMPLETE`, and `ARCHIVED`.

## 7. Implemented workflows and data flow

### Patient administration

1. `/info` fetches patient summaries directly on the server and displays insurance/authorization progress.
2. `/info/new` posts a browser form to the `createPatient` Server Action.
3. The action validates and normalizes fields with `lib/validatePatient.ts`, writes through Prisma, revalidates `/info`, and redirects.
4. `/info/[id]` loads a complete patient record. Its edit form calls `updatePatient`, which repeats validation, updates the record, revalidates the list/detail pages, and redirects.

Patient validation covers required fields, email shape, past birth date, two-letter state, ZIP format, non-negative authorization limits, case normalization, and duplicate email handling.

### Insurance form lifecycle

1. `/insurance` queries patients and lets staff choose a patient plus one of:
   - `CMS_1500`
   - `ASH_MNR`
   - `PI_REPORT`
2. `/insurance/[formType]?patientId=<id>` validates the form type and patient, loads the patient, and provides a template definition to a client-side form.
3. The client initializes matching fields from the patient record. Template metadata governs labels, sections, required fields, input types, and which fields may be AI-filled.
4. **Optional AI autofill:** the client calls `POST /api/insurance/autofill`.
5. Staff review and manually edit all values. Fields inserted by AI are visually marked “AI draft — review required”; a manual edit removes that marker.
6. **Save draft:** the client calls `POST /api/insurance/save`, which creates a `Document` in `DRAFT` status. The full submitted form object is serialized into `Document.notes`; no filled PDF is generated.

### AI autofill and privacy path

`POST /api/insurance/autofill` loads the selected patient plus up to ten newest documents and ten newest emails. It constructs textual context, gathers fields marked `aiFillable` in the form template, and runs this sequence:

1. `loadEntities()` queries all patient names and member IDs for entity-aware detection.
2. `redact()` replaces detected identifiers with tokens such as `{{PATIENT_NAME_17}}`.
3. The redacted prompt goes to `callAI()` using Groq JSON mode and a low temperature (`0.3`).
4. The JSON reply is parsed and `unredact()` restores only tokens present in the local token map.
5. Name/address cleanup handles common model response shapes.
6. `scanText()` rejects final values containing SSN, email, or phone patterns and warns on generic capitalized pairs.
7. The API returns only non-empty suggested fields and fill/skip counts.

This is a protective application-layer flow, not a HIPAA compliance guarantee. The implementation must be reviewed for the organization’s legal, contractual, logging, retention, access-control, and vendor requirements before it handles real PHI.

### Calendar and tasks

The calendar page performs two partially independent operations:

- **Persisted tasks:** fetches `GET /api/events`, maps Prisma tasks to display events in Pacific time, and invokes `/api/events` endpoints for create, update, delete, completion, and archive operations.
- **Mock/external email analysis:** polls a port-3001 API for emails and AI-derived schedule data. The UI currently passes persisted `dbEvents` to `ScheduleDashboard`, so the fetched external `scheduleEvents` are not used to render that component.

The local `calendar` directory contains CSV readers and Groq-backed email/scheduling analysis functions with rule-based fallbacks. Root-level `index.js` exposes them through Express and keeps results in memory. However, `csvParser.js` resolves its inputs relative to the calendar directory (`app/(dashboard)/data/*.csv`), while the committed files are under `app/data/*.csv`; the sidecar therefore cannot load the sample data without a path fix. Treat this section as incomplete integration work.

## 8. PII-redaction design

The redaction library is intentionally separated from the model provider:

- `detectors.ts` finds SSNs, email addresses, phone numbers, dates/DOS values, addresses, claim IDs, authorization IDs, member IDs, and patient entities.
- `overlap.ts` resolves detector overlaps.
- `service.ts` performs pure replacement/unreplacement and retains the token-to-original-value map only in memory for the request.
- `entities.ts` supplies patient names/member IDs from the database.
- `miss-detection.ts` scans output for high-severity identifier patterns after unredaction.
- `lib/ai/provider.ts` accepts the branded `RedactedText` type, which prevents ordinary TypeScript call sites from passing a plain string without an explicit cast.

Important constraint: the Groq provider type-safely requires a redacted *user prompt*, but a system prompt remains a normal string. Current insurance and calendar system prompts contain instructions rather than patient data, which is appropriate; future changes should preserve that separation.

## 9. Recent merged PRs

The working tree was clean during this review. The latest main-branch work is already merged:

### PR #30 — Insurance form templates

Merged as `e892707` from `feat/13-insurance-templates`.

- Added the insurance list, patient/form selector, dynamic form page, and form renderer.
- Added three template definitions in `lib/insurance/templates.ts`: CMS-1500, ASH MNR, and PI report.
- Added Insurance navigation to the sidebar.
- The initial insurance page copy still says AI autocomplete “will be added in a future update.” That text is stale after PR #31.

### PR #31 — AI insurance autofill

Merged as `bcf91d0` from `feat/14-insurance-autocomplete`.

- Added `POST /api/insurance/autofill` and `POST /api/insurance/save`.
- Added AI-fill state, review markers, error/success states, and save/autofill buttons to `InsuranceForm.tsx`.
- Expanded form-template metadata to distinguish AI-fillable fields.
- Implements redact → Groq JSON response → unredact → PII scan for the insurance workflow.

Earlier notable merges added the Groq provider/redaction transition and calendar-related work. The project history indicates an intentional replacement of Gemini with Groq, but several calendar comments and fallback messages still use the old “Gemini” name.

## 10. Current health and verification

Commands run against the reviewed branch:

- `npm run typecheck` — **passes**.
- `npm run lint` — **passes with 8 warnings**.
- `npm test` — **passes: 27 tests** for patient validation.

The eight lint warnings are unused imports/state/variables in calendar code and event endpoints. The test configuration needs attention:

- `package.json` defines the `test` script twice; JavaScript keeps the last definition, so `npm test` runs only `lib/__tests__/**/*.test.mjs`.
- The existing Vitest suites in `lib/redaction/__tests__/redaction.test.ts` and `lib/ai/__tests__/provider.test.ts` are therefore not run by the default test command.
- The Node test runner emits an experimental type-stripping warning and reparses the TypeScript validation module as ESM because `package.json` has no `"type": "module"`.

No production build, real database migration, or live Groq request was run in this review because those require configured external credentials/services.

## 11. Known gaps and risks

These are observed implementation gaps, not merely future enhancements:

1. **No authentication or authorization.** All server actions and API routes accept requests without a user identity or role check. This is the most critical blocker for any real patient data.
2. **No complete email dashboard.** `/` is a welcome page while the sidebar calls it “Email.” There is no maintained Next.js endpoint for loading, analyzing, persisting, or sending email.
3. **Calendar sidecar is not runnable as checked.** The port-3001 Express server exists in `index.js` but is not included in npm scripts, reads `.env` rather than `.env.local`, and resolves mock CSV files to `app/(dashboard)/data/` even though they live in `app/data/`. Its externally fetched schedule data is also unused in the displayed dashboard.
4. **Fallback scheduling has a runtime error.** `scheduleService.js` references `email` outside its `emails.map()` callback before producing fallback events. When the Groq scheduling path fails, the fallback can throw instead of supplying events.
5. **Seed fixtures are incomplete.** `prisma/seed.ts` requires seven PDF fixture files, but `public/fixtures/documents/` contains only its README; `npm run db:seed` will abort until the files are supplied or the check/data model is changed.
6. **No real document output/review workflow.** Insurance saves create `Document` rows with JSON in `notes` and an empty `fixturePath`; they do not generate PDFs, validate required fields before saving, show a document history, or implement approval/submission.
7. **API validation/error handling is uneven.** The insurance endpoints validate request shape and patient/template existence. The task endpoints largely trust request bodies and do not consistently convert Prisma errors into 4xx/5xx responses.
8. **Inconsistent source conventions.** The application mixes TypeScript, JavaScript, and JSX in the calendar feature. The calendar files contain debugging logs, stale Gemini wording, and unused state/variables.
9. **Security/operational hardening is incomplete.** There is no visible rate limiting, audit log, structured monitoring, CSRF strategy, security headers, background reminder sender, or deployed email synchronization path.
10. **README is outdated.** It is still primarily the default Create Next App README; it now links here but does not yet provide a concise project setup guide.
11. **Navigation is incomplete.** `/forms` is presented as a sidebar destination but no corresponding route is present.

## 12. Suggested learning path

For a focused code tour, read these in order:

1. `prisma/schema.prisma` — domain vocabulary and relationships.
2. `prisma/seed.ts` — the synthetic sample scenario and expected data.
3. `app/(dashboard)/layout.tsx` and `components/Sidebar.tsx` — page shell and navigation.
4. `app/(dashboard)/info/page.tsx` and `app/(dashboard)/info/actions.ts` — the cleanest complete CRUD-style workflow.
5. `lib/insurance/templates.ts`, then `app/(dashboard)/insurance/[formType]/InsuranceForm.tsx` — dynamic template-driven UI.
6. `app/api/insurance/autofill/route.ts` — the main AI business flow.
7. `lib/redaction/service.ts`, `detectors.ts`, and `miss-detection.ts` — the privacy layer.
8. `lib/ai/provider.ts` — the external AI boundary.
9. `app/(dashboard)/calendar/page.tsx` — current integration debt and task API usage.

## 13. Sample inbox AI analysis

Staff can trigger batch AI analysis of the seeded sample inbox by clicking **Analyze inbox** on `/email`. The button calls `POST /api/email/analyze-sample`, which:

1. Queries only synthetic (seeded) emails — those with `gmailMessageId IS NULL` and no existing `aiAnalysis`.
2. Maps rows to `analyzeEmails()` using the existing Groq + PII-redaction pipeline (batch size 3, 1 s pause between batches).
3. Persists `aiSummary`, `aiDraft`, and the full `aiAnalysis` JSON to each `Email` row by Prisma ID.
4. Returns counts `{ analyzed, skipped, failed }` and surfaces failures in the UI.

The action is idempotent — re-running skips already-analyzed emails unless `force: true` is passed in the request body. It requires `GROQ_API_KEY` in `.env.local` and has no dependency on Gmail OAuth, `import-gmail`, or calendar task creation.

Implementation notes: `docs/SAMPLE_INBOX_AI_ANALYSIS_HANDOFF.md` contains the full feature specification. The email analysis Groq call was updated to use `jsonMode: true` (previously strict `json_schema`), which also benefits the existing Gmail import path.

---

## 14. Practical next milestones

To move from prototype toward a coherent operational product, prioritize:

1. Add authentication, role-based authorization, audit logging, and a PHI/security review before non-synthetic data.
2. Repair and document the Express sidecar (scripts, `.env.local` loading, CSV paths, and fallback), or migrate its responsibilities into Next.js API routes.
3. Implement a document lifecycle: form validation, draft retrieval, review/approval, PDF generation, and a patient document history.
4. Replace the default README with a concise setup guide and link to this overview.
5. Repair the test scripts so both Node and Vitest suites run in CI; clean the lint warnings as part of calendar consolidation.
6. Remove or implement dead routes, unused dependencies, stale Gemini text, and placeholder insurance copy.
