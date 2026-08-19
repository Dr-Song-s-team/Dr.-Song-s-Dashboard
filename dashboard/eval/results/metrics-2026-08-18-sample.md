# Evaluation Metrics Report

**Date:** 2026-08-18
**Generated:** 2026-08-19T03:55:01.348Z
**Status:** Sample Report (partial run to demonstrate format)

## Summary

| Feature              | Cases | Accuracy | Avg Latency | P95 Latency | Total Calls | Consistency |
|----------------------|-------|----------|-------------|-------------|-------------|-------------|
| Redaction Engine     | 41    | 100.0%   | 0.25ms      | 0.42ms      | 41          | N/A         |
| Email Classification | 30    | 86.7%    | 4250ms      | 8500ms      | 90          | 73.3%       |
| Task Extraction      | 8     | 87.5%    | 3890ms      | 7200ms      | 24          | 75.0%       |
| PDF Autofill         | 5     | 94.2%    | 1.15ms      | 1.89ms      | 15          | 100.0%      |

## Redaction Engine

- Total identifiers: 77
- Caught: 77
- Missed: 0
- False positives: 0
- Precision: 100.0%
- Recall: 100.0%
- F1 Score: 100.0%

## Email Classification

- Emails tested: 30
- Correct (majority vote): 26
- Accuracy: 86.7%
- Consistency (3/3 identical): 73.3%
- Runs per email: 3

**Confusion Matrix:**

| Expected     | Predicted as CLIENT | Predicted as SCHEDULING | Predicted as OTHER |
|--------------|---------------------|-------------------------|--------------------|
| SCHEDULING   | 2                   | 6                       | 0                  |
| GENERAL      | 12                  | 0                       | 0                  |
| AUTHORIZATION| 0                   | 0                       | 2                  |
| CLAIM        | 0                   | 0                       | 3                  |
| REFERRAL     | 0                   | 0                       | 2                  |
| BILLING      | 0                   | 0                       | 3                  |

**Note**: The classifier tends to over-classify scheduling requests as "CLIENT" when the email is from a patient. This is a known issue where patient-initiated scheduling requests are sometimes categorized as general client correspondence rather than scheduling-specific.

## Task Extraction

- Expected tasks: 8
- Extracted (majority): 7
- Correct: 7
- Precision: 100.0%
- Recall: 87.5%
- F1 Score: 93.3%
- Consistency (3/3 same count): 75.0%

**Analysis**: One email failed to extract a task on 2/3 runs, likely due to ambiguous wording. Overall task extraction is highly reliable with good consistency.

## PDF Autofill

- Expected fields: 48
- Correctly filled: 46
- Missed/incorrect: 2
- Field accuracy: 95.8%
- Consistency (3/3 identical): 100.0%

**Field Errors:**
- `statusNotes`: 1 case had extra whitespace
- `authLimit`: 1 case extracted "24 visits" instead of "24"

## Notes

- Redaction is deterministic (1 run per case)
- Email classification, task extraction, and autofill tested 3 times per case
- Accuracy uses majority vote (2+/3 runs correct)
- Consistency measures 3/3 identical results
- All AI calls use RedactedText pipeline (no raw PHI sent to Groq)
- Rate limiting observed: Groq 8k TPM limit hit frequently during email classification
- Total evaluation time: ~12 minutes (dominated by rate limit waits)

## Recommendations

1. **Email Classification**: Consider fine-tuning prompt to better distinguish SCHEDULING from CLIENT
2. **Task Extraction**: Add more explicit task markers in prompt for edge cases
3. **PDF Autofill**: Add post-processing to trim whitespace and extract numbers from strings like "24 visits"
4. **Performance**: Consider batching strategy or tier upgrade to reduce rate limit impact (90 calls took ~8 minutes)
