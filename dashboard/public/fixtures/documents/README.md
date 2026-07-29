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

Six of the seven files are blank form templates with no data filled in.
`sample-pi-report.pdf` is a completed sample report; the patient it names,
"Gil Dong Hong", is the standard Korean placeholder equivalent of "John Doe".
The only contact details in any file are the clinic's own public business
address, phone, and `info@` address.

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
