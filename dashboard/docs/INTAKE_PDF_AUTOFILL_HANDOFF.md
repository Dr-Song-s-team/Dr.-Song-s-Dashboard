# Handoff: New Patient Intake — PDF Upload Autofill

**Status:** Spec / context only — not implemented  
**Created:** 2026-08-09  
**Owner for implementation:** next agent taking this feature  
**Primary UI surface:** `/info/new` (`app/(dashboard)/info/new/`)

---

## 1. Goal

When creating a new patient on the New Patient Intake page, staff can upload a patient intake PDF (e.g. `sample-intake-1-1.pdf`). The app extracts patient data from that PDF and autofills the intake form.

### Acceptance criteria (from product)

1. There is an **Upload Intake** control at the **bottom** of the new patient intake page.
2. Users can **drag-and-drop** an intake PDF or **choose a file** from their computer.
3. On success, **all patient intake fields** are autofilled from the PDF.
4. On failure, the UI **clearly shows that autofill failed** (do not silently leave the form empty).
5. Manual edit / Save Patient must still work after a successful or failed autofill attempt.

---

## 2. Current code (what exists today)

### New patient page

| File | Role |
|---|---|
| `app/(dashboard)/info/new/page.tsx` | Server page shell: title “New Patient Intake”, renders `IntakeForm` |
| `app/(dashboard)/info/new/IntakeForm.tsx` | Client form: uncontrolled inputs + `useActionState(createPatient)` |
| `app/(dashboard)/info/actions.ts` | Server Actions `createPatient` / `updatePatient` |
| `lib/validatePatient.ts` | Shared validation + `buildPatientData` (`PatientFields`) |

There is **no** PDF upload, parse, or autofill path for intake yet.

### Closest existing pattern to reuse

Insurance AI autofill (different direction: DB patient → form, not PDF → patient):

| File | Reuse for |
|---|---|
| `app/(dashboard)/insurance/[formType]/InsuranceForm.tsx` | Loading/error banner UX, clear failure messaging |
| `app/api/insurance/autofill/route.ts` | Pipeline: redact → `callAI` (JSON mode) → unredact → `scanText` |
| `lib/ai/provider.ts` | Groq `callAI` |
| `lib/redaction/*` | PII redaction before model calls |

Do **not** call `/api/insurance/autofill` for this feature. Add a dedicated intake endpoint.

### Form fields that must be filled (`PatientFields`)

Required (must validate via `validatePatient` before save):

- `firstName`, `lastName`, `dob` (`YYYY-MM-DD` for `<input type="date">`)
- `phone`, `email`
- `address`, `city`, `state` (2-letter), `zip` (`#####` or `#####-####`)
- `insurer`, `memberId`, `authLimit` (non-negative integer string)

Optional:

- `statusNotes`

Placeholders already used on the form (Alex Thompson seed persona): see `IntakeForm.tsx` and `prisma/seed.ts`.

---

## 3. Fixture PDFs (critical constraint)

Location: `public/fixtures/documents/`

| File | Contents relevant to this feature |
|---|---|
| `sample-intake-1-1.pdf` | Patient Information + Insurance sections (English/Spanish/Korean). **Blank template** — labels only, no filled values. No AcroForm fields (`pdfinfo` → `Form: none`). Single very tall page. |
| `sample-intake-1-2.pdf` | Symptoms / clinical questionnaire continuation. Not a demographics source. |
| `sample-intake-1-3.pdf` | Additional intake pages. Not a demographics source. |

Documented in `public/fixtures/documents/README.md`: six of seven fixtures are blank templates. Seed associates 1-1/1-2/1-3 with “Alex Thompson” by **title only**, not because the PDF contains that data.

### Implication for acceptance testing

Uploading the committed `sample-intake-1-1.pdf` **cannot** successfully autofill real values today. Correct behavior for blank/unreadable PDFs is a **clear autofill failure**.

To satisfy “all fields autofilled” in a happy-path demo/test, the implementer should also add a **synthetic filled** PDF fixture (still de-identified), e.g.:

- `public/fixtures/documents/sample-intake-filled-alex.pdf`

…with values matching the Alex seed persona (or another fake persona), and document it in the fixtures README. Do not use real PHI.

Suggested filled values (align with seed / form placeholders):

```text
firstName: Alex
lastName: Thompson
dob: 1978-03-15
phone: 555-0101
email: alex.thompson@example-patient.dev
address: 100 Maple St
city: Anytown
state: CA
zip: 90001
insurer: Anthem
memberId: ANT-2024-001
authLimit: 24   # may need to appear in notes/insurance text; see field mapping gap below
statusNotes: Active; next auth renewal due 2024-09-01.
```

---

## 4. PDF → form field mapping

From `sample-intake-1-1.pdf` text structure (section “PATIENT INFORMATION” / “INSURANCE”):

| Intake PDF label (approx.) | `PatientFields` key | Notes |
|---|---|---|
| First Name | `firstName` | |
| Last Name | `lastName` | Middle initial ignored |
| Date of Birth (M/D/YYYY) | `dob` | Normalize to `YYYY-MM-DD` |
| Mobile Phone (prefer) / Home / Work | `phone` | Prefer mobile |
| Email | `email` | |
| Street Address (+ Apt if present) | `address` | Concatenate apt/unit if useful |
| City | `city` | |
| State | `state` | Normalize to 2-letter uppercase |
| Zip Code | `zip` | |
| Primary insurance company | `insurer` | Multilingual labels (EN/ES/KR) |
| Member ID / policy # | `memberId` | |
| *(none clear)* | `authLimit` | **Gap:** clinic auth visit limit is not a standard label on this intake PDF |
| Clinical/status free text if any | `statusNotes` | Optional |

### `authLimit` product decision (resolve during build)

Because AC says all fields autofill, pick one and document in PR:

1. **Preferred for prototype:** If PDF has no auth visit limit, treat autofill as **partial success** only when all *PDF-mappable* required fields filled; leave `authLimit` empty and show a warning that auth limit must be entered manually — **or**
2. Look for phrases like “authorized visits”, “auth limit”, “units approved” in extracted text and map those; if still missing, **fail autofill** when any required field is empty; **or**
3. Default `authLimit` to a constant (e.g. `"0"`) only if product agrees (weaker; avoid inventing clinical/auth data silently).

Do **not** invent insurer/member IDs. Prefer null/omit + failure/partial messaging over hallucinated values (same rule as insurance autofill system prompt).

---

## 5. Recommended architecture

```text
Browser (IntakeForm)
  │  multipart PDF upload (drag/drop or file picker)
  ▼
POST /api/intake/autofill   (new route)
  │  1. Validate: Content-Type PDF, size limit, magic bytes
  │  2. Extract text from PDF (no AcroForm on fixtures)
  │  3. If extracted text has no usable patient signals → 422 with clear error
  │  4. redact(extractedText) → callAI(jsonMode) → unredact → scanText
  │  5. Normalize to PatientFields-shaped JSON
  ▼
Client applies values into form state
  │  success banner / failure banner
  ▼
Existing createPatient Server Action (unchanged save path)
```

### Suggested API contract

`POST /api/intake/autofill`

- **Request:** `multipart/form-data` with field `file` (PDF).  
  Alternate acceptable: JSON `{ "pdfBase64": "..." }` if simpler for tests — prefer multipart for real UX.
- **Success `200`:**

```json
{
  "fields": {
    "firstName": "Alex",
    "lastName": "Thompson",
    "dob": "1978-03-15",
    "phone": "555-0101",
    "email": "alex.thompson@example-patient.dev",
    "address": "100 Maple St",
    "city": "Anytown",
    "state": "CA",
    "zip": "90001",
    "insurer": "Anthem",
    "memberId": "ANT-2024-001",
    "authLimit": "24",
    "statusNotes": "..."
  },
  "filledCount": 12,
  "skippedCount": 0,
  "warnings": []
}
```

- **Failure examples (must surface in UI):**
  - `400` — not a PDF / empty file / too large
  - `422` — PDF readable but no patient data found (blank template case)
  - `500` / `502` — AI parse failure, invalid JSON from model, missing `GROQ_API_KEY`
  - Body always includes `{ "error": "<human-readable message>" }`

Success policy recommendation: require every **required** `PatientFields` key non-empty before treating as full success. If some required keys missing → either return `422` or `200` with `warnings` + partial `fields` and let UI show a distinct **partial / failed** state. Align with AC: failure must be obvious; partial should not look like full success.

### Privacy

Follow insurance autofill: never send raw PHI to Groq without `redact()`. System prompt may instruct copying `{{TOKEN}}` placeholders. Run `scanText` on unredacted outputs. Log fill counts, not field values.

Env: `GROQ_API_KEY` (and optional `GROQ_MODEL`) already used by the app.

### PDF text extraction dependency

No PDF library is in `package.json` today. Add a Node-friendly extractor (evaluate current Next 16 / Node compatibility in `node_modules/next/dist/docs/` before locking choice). Candidates commonly used: `unpdf`, `pdf-parse`, `pdfjs-dist`. Fixtures are text PDFs (Quartz), not scanned images — start with text extract; OCR is out of scope unless text is empty and product expands scope.

---

## 6. UI requirements (`IntakeForm.tsx`)

### Placement

At the **bottom** of the form, with Cancel / Save Patient. Suggested layout:

```text
[ form sections … ]

────────────────────────────────
Upload Intake
Drag a PDF here or choose a file
[ Upload Intake ]   (or drop zone that is the control)

Cancel          Save Patient
```

Match existing visual language: warm neutrals, `rounded-xl`, rose error banners already used for `state.message`. Insurance uses amber for AI autofill — intake upload may use the same amber pattern or a quieter border matching Cancel; keep consistency with `/info` pages.

### Interaction

1. Accept `application/pdf` only; reject others with inline error.
2. Show uploading/parsing spinner (“Reading intake PDF…”).
3. On success: populate all fields; optional short success note (“Intake autofilled — review before saving”).
4. On failure: prominent error region (`role="alert"`), title like **Autofill failed**, body = server `error` message. Do not clear unrelated user-typed fields unless product wants overwrite-on-upload; recommended: only overwrite keys returned in `fields`, leave others as-is; on total failure leave form unchanged.
5. Drag-and-drop: highlight drop zone on dragover; support click-to-browse.

### Controlled vs uncontrolled inputs (implementation note)

`IntakeForm` today is **uncontrolled** (`defaultValue` / empty + FormData submit). Autofill requires either:

- Convert fields to **controlled** state (`value` + `onChange`) and keep submitting via FormData / hidden sync; or
- Keep uncontrolled but remount the form with `key={autofillGeneration}` and pass `defaultValues` from parse result.

Controlled is closer to `InsuranceForm` and easier for post-fill edits. Prefer controlled for the autofill path; ensure `createPatient` still receives the same field names.

---

## 7. Suggested file touch list

New:

- `app/api/intake/autofill/route.ts` — upload + parse + AI extract
- `lib/intake/extractPdfText.ts` — PDF bytes → text
- `lib/intake/parseIntakeFields.ts` — text → `PatientFields` (prompt + normalize); unit-testable
- `lib/intake/__tests__/…` — normalization / mapping tests with fixture text snippets
- (optional) `public/fixtures/documents/sample-intake-filled-alex.pdf` + README row

Edit:

- `app/(dashboard)/info/new/IntakeForm.tsx` — upload UI + apply fields + failure banner
- `package.json` — PDF dependency
- `docs/PROJECT_OVERVIEW.md` — brief note under patient administration (after ship)

Avoid changing `createPatient` validation semantics unless needed for autofill edge cases.

---

## 8. Implementation plan (ordered)

1. Add PDF text extraction helper; verify against `sample-intake-1-1.pdf` (expect labels, empty values).
2. Add `/api/intake/autofill` with validation + blank-PDF → clear `422`.
3. Wire Groq JSON extraction + redaction pipeline; normalize DOB/state/zip/phone.
4. Convert `IntakeForm` for autofill + bottom **Upload Intake** drop zone.
5. Add filled synthetic PDF for happy-path manual/automated test.
6. Unit tests: field normalization; API tests if practical (mock `callAI`).
7. Manual QA checklist (below).
8. Update overview doc.

---

## 9. Manual QA checklist

- [ ] `/info/new` shows **Upload Intake** at bottom (with Cancel/Save).
- [ ] Drag-and-drop PDF works; file picker works.
- [ ] Non-PDF rejected with clear message.
- [ ] Blank `sample-intake-1-1.pdf` → **Autofill failed** (or equivalent), form not falsely marked success.
- [ ] Filled synthetic PDF → all required fields populated; user can edit; Save creates patient.
- [ ] Missing `GROQ_API_KEY` → clear failure (not empty catch-all).
- [ ] After failed autofill, user can still fill manually and save.
- [ ] Duplicate email still returns existing validation error from `createPatient`.

---

## 10. Out of scope (unless product expands)

- Persisting the uploaded PDF as a `Document` row (nice follow-up; seed already has `INTAKE_1_*` types).
- OCR for scanned image-only PDFs.
- Autofill on the edit patient page (`/info/[id]`).
- Generating PDFs or changing insurance autofill.
- AuthN/AuthZ (still absent app-wide).

---

## 11. Quick commands

```bash
cd dashboard
npm run dev
# open /info/new

npm run typecheck
npm test
```

Fixture path for local testing:

`/fixtures/documents/sample-intake-1-1.pdf`  
(filesystem: `public/fixtures/documents/sample-intake-1-1.pdf`)

---

## 12. One-paragraph brief for the implementing model

Implement PDF intake autofill on `/info/new`: add a bottom **Upload Intake** drag-and-drop/file control on `IntakeForm.tsx`, a new `POST /api/intake/autofill` that extracts PDF text, runs the existing redact → Groq JSON → unredact → scan pipeline, and returns `PatientFields`. Apply results into the form (prefer controlled inputs). Surface failures clearly. Committed sample intake PDFs are blank templates—blank uploads must fail visibly; add a synthetic filled fixture to prove full autofill. Reuse patterns from insurance autofill UX/AI, but do not reuse that API. Map PDF demographics/insurance labels into `lib/validatePatient.ts` fields; resolve `authLimit` explicitly because it may be absent from the PDF.
