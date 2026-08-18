# Fixture Documents

Synthetic, de-identified PDF samples used by the development seed data.

**All files in this directory must remain fully de-identified and synthetic.
Never add real patient documents.**

These files are committed to the repository so the development seed can reference
them and the UI can serve them at `/fixtures/documents/<filename>`.

## Expected files

| Filename | Document type | Seed reference |
|---|---|---|
| `sample-intake-1-1.pdf` | Patient Intake Form 1-1 | Alex Thompson |
| `sample-intake-1-2.pdf` | Patient Intake Form 1-2 | Alex Thompson |
| `sample-intake-1-3.pdf` | Patient Intake Form 1-3 | Alex Thompson |
| `sample-soap-note.pdf` | SOAP Note | Maria Santos |
| `sample-cms-1500.pdf` | CMS-1500 Insurance Claim Form | James Mitchell |
| `sample-ash-mnr.pdf` | ASH Medical Necessity Review | Lisa Park |
| `sample-pi-report.pdf` | Personal Injury Report | David Rivera |
| `synthetic_fillable_intake_filled.pdf` | Synthetic filled AcroForm intake used for PDF autofill testing | Avery Tester |
| `dr_song_intake_page1_filled_reference.pdf` | Dr. Song multilingual AcroForm (EN/ES/KO) reference fixture for PDF autofill expansion testing; uses `patient_en.*` / `insurance_primary.*` field naming | Avery Tester |

Six of the eight files are blank form templates with no data filled in.
`sample-pi-report.pdf` is a completed sample report; the patient it names,
"Gil Dong Hong", is the standard Korean placeholder equivalent of "John Doe".
The only contact details in any file are the clinic's own public business
address, phone, and `info@` address.
`synthetic_fillable_intake_filled.pdf` is a separate, fully synthetic AcroForm
fixture. It exercises the additional fillable-PDF format without replacing the
existing text-based intake templates. Its authorization limit is intentionally
absent because that field does not exist in the source form; staff must enter
that value manually before saving.

## Adding files

Copy your synthetic PDFs here using the filenames in the table above, then run:

```bash
npm run db:seed
```

The filenames must match the table exactly — the seed script checks that each
file exists and aborts with the list of missing names rather than creating
`Document` rows whose paths 404. Rename source files to these names instead of
changing the seed, so the paths stay URL-safe and free of patient identifiers.

Document rows reference paths as `/fixtures/documents/<filename>` which Next.js
serves directly from this `public/` subdirectory.
