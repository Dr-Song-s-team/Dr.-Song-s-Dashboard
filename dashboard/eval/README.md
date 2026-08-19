# Evaluation Harness

Measures accuracy metrics for 4 core features using ground-truth datasets.

## Quick Start

```bash
npm run eval:metrics
```

Results are written to:
- **stdout** - Live progress and final summary table
- **eval/results/metrics-YYYY-MM-DD.md** - Full markdown report

## Structure

```
eval/
├── datasets/           # Ground-truth test cases (JSON)
│   ├── redaction.json
│   ├── email-classification.json
│   ├── tasks.json
│   └── autofill.json
├── results/            # Generated reports
│   └── metrics-*.md
├── run-metrics.ts      # Main evaluation runner
└── README.md           # This file
```

## Features Evaluated

### 1. Redaction Engine
- **Dataset**: 41 test cases (30 with PHI, 11 without)
- **Runs**: 1 per case (deterministic)
- **Metrics**: Precision, recall, F1 score, false positive rate

### 2. Email Classification
- **Dataset**: 29 emails (from seed data: 20 client, 9 insurance, 0 spam)
- **Runs**: 1 per email = 29 total AI calls
- **Metrics**: Accuracy (% correct classifications)
- **Categories**: client | insurance | spam (AI taxonomy, NOT database categories)

### 3. Task/Action Extraction
- **Dataset**: 8 scheduling emails with expected recommendedActions (string arrays)
- **Runs**: 3 per email = 24 total AI calls
- **Metrics**: Precision (% of extracted actions that match expected), recall (% of expected actions found), F1 score, consistency rate
- **Comparison**: Fuzzy string matching with >70% word overlap threshold

### 4. PDF Autofill (Pattern-based, NOT AI)
- **Dataset**: 5 patient intake PDFs with known field values
- **Runs**: 1 per PDF (deterministic regex parsing)
- **Metrics**: Field-level accuracy
- **Pipeline**: Redact → parseIntakeFields (regex) → Unredact
- **NOTE**: Production autofill uses pattern matching, NOT AI

## Retry Logic

- **Redaction & PDF Autofill**: No retries (deterministic pattern matching)
- **Email classification**: 1 run per email (reduced from 3 to save tokens)
- **Task extraction**: 3 runs per email with fuzzy matching against expected actions
- **Rate limiting**: Automatic exponential backoff with Groq retry hints (AI features only)
- **Consistency**: Reports % of cases with 3/3 identical results (task extraction only)

## Performance Tracking

All features log:
- Average latency (ms)
- P95 latency (ms)
- Total API calls made

## Notes

- **AI Features**: Only 2 of 4 features use AI (email classification, task extraction)
- All AI calls use the RedactedText pipeline (no raw PHI sent to Groq)
- Email classification may be slow due to Groq rate limits (8k TPM)
- Task extraction uses fuzzy matching (70%+ word overlap) to compare actions
- Email classification runs once per email (no majority voting)
- Task extraction runs 3x per email; consistency measures 3/3 identical results
- **Pattern-based features** (redaction, PDF autofill): Single deterministic run per case
- **Total AI calls**: 29 (classification) + 24 (tasks) = 53

## Extending

To add new test cases:

1. Edit the appropriate JSON file in `eval/datasets/`
2. Follow the existing schema structure
3. Run `npm run eval:metrics` to regenerate metrics
