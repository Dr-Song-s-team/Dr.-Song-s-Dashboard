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

## Adding files

Copy your synthetic PDFs here using the filenames in the table above, then run:

```bash
npm run db:seed
```

The seed script will create `Document` rows pointing to these paths.
Document rows reference paths as `/fixtures/documents/<filename>` which Next.js
serves directly from this `public/` subdirectory.
