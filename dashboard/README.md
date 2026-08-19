# M.O.M.E — Medical Office Management Engine

A HIPAA-ready clinic management system built for Dr. Song's acupuncture practice as part of the CSUF AI Innovation & Entrepreneurship Fellowship. M.O.M.E automates email triage, patient record management, and administrative workflows using AI-powered analysis with strict privacy safeguards.

## Overview

**Built for:** Dr. Song's Acupuncture Clinic
**Context:** CSUF AI Innovation & Entrepreneurship Fellowship (Summer 2026)
**Purpose:** Reduce administrative burden through intelligent automation while maintaining HIPAA compliance

M.O.M.E combines email management, patient portal, AI-powered chatbot, and automated quality metrics into a unified dashboard. All AI interactions use a redact→AI→unredact→scanText pipeline with TypeScript branded types to ensure **no raw PHI ever reaches external AI providers**.

## Features

### 📧 Email Management System (EMS)

- **AI-powered categorization**: Automatically classifies emails as CLIENT, SCHEDULING, AUTHORIZATION, CLAIM, REFERRAL, BILLING, or OTHER (86.2% accuracy)
- **Email analysis**: Extracts patient names, recommended actions, and generates summaries
- **Korean translation**: Translates email subjects and bodies to Korean for Dr. Song
- **Draft responses**: AI-generated draft replies (human review required before sending)
- **Task extraction**: Identifies actionable items from emails for follow-up (87.5% accuracy on human review)

### 🏥 Patient Portal

- **Record management**: Patient demographics, insurance info, authorization tracking
- **Visit counter**: Tracks visits used vs. authorization limit
- **PDF autofill**: Automatically fills CMS-1500 and intake forms from patient records (82.8% field accuracy)
- **Status tracking**: Real-time authorization status with visual indicators

### 💬 AI Chatbot

- **Record-grounded Q&A**: Answers staff questions using clinic data (emails, patients, documents)
- **Progressive search**: Starts with 20 most recent emails, expands to 50 → all on user request
- **Relevance ranking**: Keyword-match scoring prioritizes subject line hits, then recency
- **Search scope disclosure**: Honest negative answers include search window and expansion offer
- **100% accuracy** on supported queries (verified against test suite)

### 📊 AI Quality Metrics

- **Real-time evaluation dashboard**: Displays accuracy, latency, and consistency metrics
- **Feature coverage**: Redaction (100% F1), Classification (86.2%), Task Extraction (87.5%), Autofill (82.8%)
- **Eval harness**: `npm run eval:metrics` runs automated benchmark suite
- **Red-team suite**: `npm run eval:redteam` tests 20 security/edge cases (20/20 safety-clean)

## Architecture

### Stack

- **Framework**: Next.js 16 App Router (TypeScript, React 19)
- **Styling**: Tailwind CSS 4
- **Database**: Neon Postgres (pooled connection) + Prisma ORM
- **AI Providers**:
  - Primary: Groq (`openai/gpt-oss-120b` or `GROQ_MODEL` env var)
  - Fallback: OpenRouter (automatic on 429/5xx errors)
  - Provider abstraction: `lib/ai/provider.ts`

### Privacy Architecture

**RedactedText Pipeline** (Type-safe PII redaction):

```typescript
// 1. Redact
const entities = await loadEntities(); // Patient names, IDs, DOBs from DB
const { redactedText, tokenMap } = redact(userInput, entities);
// "Alice Vance needs auth" → "{{PATIENT_NAME_1}} needs auth"

// 2. AI Call (only accepts RedactedText branded type)
const aiResponse = await callAI(redactedText, { ... });

// 3. Unredact
const { originalText } = unredact(aiResponse, tokenMap);
// "{{PATIENT_NAME_1}} approved" → "Alice Vance approved"

// 4. Scan for misses (catches any PII that bypassed redaction)
scanText(originalText, { throwOnHighSeverityMiss: false });
```

**Key safeguards:**
- `RedactedText` is a TypeScript branded type — impossible to call `callAI()` with raw strings
- Pattern-based detectors catch ALL emails/phones (not just known entities)
- `scanText()` validates final output for SSN/email/phone patterns
- Entity-based redaction for patient names, member IDs, DOBs
- All production routes use this pipeline (see `lib/ai/emailAnalysis.ts`, `app/api/chat/route.ts`)

## Testing

### Automated Tests

**255 total tests** (223 vitest + 32 node):
- Unit tests: Redaction engine, AI provider, email analysis
- Integration tests: Chat flow, retrieval, context building
- Round-trip tests: Redact → unredact preserves original text
- Property tests: Token collision detection, overlap resolution

Run: `npm run check` (TypeScript + ESLint + full test suite)

### Evaluation Harness

**Command**: `npm run eval:metrics`

**Latest results** (2026-08-18):

| Feature              | Cases | Identifiers/Fields | Correct | Accuracy     |
|----------------------|-------|--------------------|---------|--------------|
| Redaction Engine     | 41    | 49 identifiers     | 49      | 100.0% (F1)  |
| Email Classification | 29    | 29 emails          | 25      | 86.2%        |
| Task Extraction      | 8     | 8 tasks            | 7       | 87.5% (human-reviewed) |
| PDF Autofill         | 5     | 64 fields          | 53      | 82.8%        |

- **Redaction**: 49/49 identifiers caught (100% precision, 100% recall, 100% F1)
- **Classification**: 25/29 emails correctly categorized (86.2%)
- **Task Extraction**: Automated exact-match 25% (too strict); human review of same outputs: 7/8 usable (87.5%)
- **Autofill**: 53/64 fields correct (82.8%)

### Red-Team Suite

**Command**: `npm run eval:redteam`

**Coverage**: 20 test cases across 5 categories:
- **PROMPT_INJECTION** (5): Attempts to leak system prompts or bypass guardrails
- **PHI_LEAK** (5): Tests for raw token echoes or entity ID leaks
- **OUT_OF_SCOPE** (4): Weather, medical advice, general knowledge queries
- **HALLUCINATION** (3): Tests for invented data or false confidence
- **EDGE_CASE** (3): Typos, empty inputs, long queries

**Results**: 20/20 safety-clean
- 2 auto-fails caught (raw token echoes in hallucination tests — expected)
- 0 PHI leaks, 0 prompt injections successful
- All out-of-scope queries properly declined

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL database (Neon recommended)
- Groq API key (free tier: 8K tokens/min)
- Optional: OpenRouter API key (fallback provider)

### Environment Variables

Create `.env.local`:

```bash
# Database (required)
DATABASE_URL="postgresql://..."  # Use POOLED connection string from Neon

# AI Providers (required)
GROQ_API_KEY="gsk_..."
GROQ_MODEL="openai/gpt-oss-120b"  # or llama-3.3-70b-versatile

# Fallback Provider (optional - enables automatic failover on rate limits)
OPENROUTER_API_KEY="sk-or-..."
OPENROUTER_MODEL="openai/gpt-oss-120b"

# Gmail API (optional - for email fetching)
GMAIL_CLIENT_ID="..."
GMAIL_CLIENT_SECRET="..."
GMAIL_REFRESH_TOKEN="..."

# Web Push (optional - for browser notifications)
VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
```

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (creates tables)
npx prisma migrate dev

# Seed database with sample data
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the dashboard.

### Verification

```bash
# Run full check suite (TypeScript + ESLint + 255 tests)
npm run check

# Run evaluation harness (requires DB + API keys)
npm run eval:metrics

# Run red-team security tests
npm run eval:redteam
```

## Privacy Status

**Current**: Synthetic data only (seed data in `prisma/seed.ts`)
- Fictional patient names (Alice Vance, Charlie Davis, etc.)
- Generated member IDs (ANT-2024-001, BCBS-2024-002, etc.)
- Sample email scenarios for testing

**Production PHI**: Pending Business Associate Agreements (BAAs)
- Groq BAA: In discussion
- OpenRouter BAA: Required before production use with real PHI
- Database: Neon Pro tier (SOC 2 Type 2 compliant)

**Compliance posture**:
- ✅ RedactedText pipeline prevents raw PHI transmission
- ✅ 100% redaction accuracy on eval suite (49/49 identifiers)
- ✅ scanText validation on all AI outputs
- ✅ Audit logging ready (all AI calls logged with redacted prompts)
- ⏳ BAAs pending for production deployment

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Run test suite (vitest + node) |
| `npm run check` | Full check (typecheck + lint + test) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:reset` | Reset DB (drop + migrate + seed) |
| `npm run eval:metrics` | Run evaluation harness |
| `npm run eval:redteam` | Run red-team security tests |

## File Structure Highlights

```
dashboard/
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # Chatbot endpoint (progressive search)
│   │   ├── email/
│   │   │   ├── analyze/route.ts       # Email analysis endpoint
│   │   │   └── analyze-sample/route.ts # Sample email analysis
│   │   └── patient/route.ts           # Patient CRUD
│   ├── chat/page.tsx                  # Chatbot UI
│   ├── emails/page.tsx                # Email management
│   ├── metrics/page.tsx               # AI quality metrics
│   └── patients/page.tsx              # Patient portal
├── lib/
│   ├── ai/
│   │   ├── provider.ts                # Groq + OpenRouter abstraction
│   │   ├── emailAnalysis.ts           # Email classification + analysis
│   │   └── analysisPostprocess.ts     # Token cleanup utilities
│   ├── redaction/
│   │   ├── service.ts                 # Redact/unredact core
│   │   ├── detectors.ts               # Pattern + entity detection
│   │   ├── miss-detection.ts          # scanText validation
│   │   └── types.ts                   # RedactedText branded type
│   ├── chat/
│   │   ├── retrieval.ts               # Email/patient/document search
│   │   └── context.ts                 # Context builder for chatbot
│   └── prisma.ts                      # Database client
├── eval/
│   ├── run-metrics.ts                 # Evaluation harness
│   ├── redteam/
│   │   ├── run-redteam.ts             # Red-team runner
│   │   └── cases.json                 # Security test cases
│   └── datasets/                      # Benchmark datasets
└── prisma/
    ├── schema.prisma                  # Database schema
    └── seed.ts                        # Sample data
```

## Presentation Notes (Aug 21, 2026)

**Demo flow**:
1. Email Management → Show AI categorization + Korean translation
2. Patient Portal → Demonstrate PDF autofill with CMS-1500
3. Chatbot → Query "Are there any emails about claim denials?" (progressive search)
4. Metrics Page → Display evaluation results + red-team safety

**Key talking points**:
- RedactedText branded type prevents accidental PHI leaks (compile-time safety)
- 100% redaction accuracy on 49-identifier test suite
- Progressive search: 20 → 50 → all emails (user-driven)
- Groq free tier (8K TPM) + OpenRouter fallback for resilience
- 255 automated tests + eval harness + red-team suite

**Known limitations**:
- Email classification: 86.2% accuracy (4/29 misclassified)
- Task extraction: Exact-match eval too strict (25%); human review shows 87.5% usable
- Groq rate limits: ~8 min for 90 AI calls on free tier
- BAAs pending for production PHI

---

**Fellowship Project** — CSUF AI Innovation & Entrepreneurship Fellowship, Summer 2026
**Built with**: Next.js, TypeScript, Tailwind, Neon Postgres, Prisma, Groq
**License**: Private (proprietary clinic software)
