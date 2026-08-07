/**
 * Deterministic seed script for dummy/synthetic data.
 * All patients, emails, and documents are entirely fictional.
 * Run: npx tsx prisma/seed.ts
 */
import { config } from "dotenv";
// Load .env.local first (Next.js convention) so DATABASE_URL is available
config({ path: ".env.local" });
config();

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "../app/generated/prisma/client";
import { requireEnv } from "../lib/env";

const fixtureBase = "/fixtures/documents";
const clinicInboxes = [
  "INFO",
  "BILLING",
  "AUTHORIZATIONS",
  "REFERRALS",
  "SCHEDULING",
  "CLAIMS",
] as const;

type ClinicInbox = (typeof clinicInboxes)[number];
type EmailStatus = "UNREAD" | "READ" | "NEEDS_ACTION" | "ARCHIVED";
type EmailClassification =
  | "AUTHORIZATION"
  | "CLAIM"
  | "REFERRAL"
  | "SCHEDULING"
  | "BILLING"
  | "GENERAL";

type CsvEmail = {
  sender: string;
  subject: string;
  body: string;
};

/**
 * Fails loudly when a fixture PDF is absent or misnamed, rather than seeding
 * Document rows whose `fixturePath` 404s in the UI.
 */
function assertFixturesPresent(paths: string[]) {
  const missing = paths.filter((p) => !existsSync(join("public", p)));

  if (missing.length > 0) {
    throw new Error(
      `Missing fixture PDF(s) in public${fixtureBase}/:\n` +
        missing.map((p) => `  - ${p.slice(fixtureBase.length + 1)}`).join("\n") +
        `\n\nFilenames must match exactly. See public${fixtureBase}/README.md.`,
    );
  }
}

function senderNameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferInbox(email: CsvEmail, index: number): ClinicInbox {
  const content = `${email.subject} ${email.body}`.toLowerCase();

  if (/\bclaim|cms-1500|eob|explanation of benefits\b/.test(content)) {
    return "CLAIMS";
  }
  if (/\bauthori[sz]|auth limit|pre-?approval\b/.test(content)) {
    return "AUTHORIZATIONS";
  }
  if (/\breferral|referring provider\b/.test(content)) {
    return "REFERRALS";
  }
  if (/\bschedule|appointment|reschedul|availability|book(?:ing)?\b/.test(content)) {
    return "SCHEDULING";
  }
  if (/\bbill|invoice|payment|insurance card|coverage\b/.test(content)) {
    return "BILLING";
  }

  // Distribute general clinic correspondence so every logical clinic inbox
  // has representative synthetic messages for the EMS demo.
  return clinicInboxes[index % clinicInboxes.length];
}

function inferInsurerLabel(email: CsvEmail) {
  const content = `${email.sender} ${email.subject} ${email.body}`.toLowerCase();
  if (/\banthem\b/.test(content)) return "Anthem";
  if (/\bblue cross\b|\bbcbs\b/.test(content)) return "Blue Cross";
  if (/\baetna\b/.test(content)) return "Aetna";
  if (/\b(united health|uhc)\b/.test(content)) return "United Health";
  if (/\bcigna\b/.test(content)) return "Cigna";
  return null;
}

function classificationForInbox(inbox: ClinicInbox): EmailClassification {
  switch (inbox) {
    case "AUTHORIZATIONS":
      return "AUTHORIZATION";
    case "CLAIMS":
      return "CLAIM";
    case "REFERRALS":
      return "REFERRAL";
    case "SCHEDULING":
      return "SCHEDULING";
    case "BILLING":
      return "BILLING";
    case "INFO":
      return "GENERAL";
  }
}

function statusForEmail(email: CsvEmail, index: number): EmailStatus {
  const content = `${email.subject} ${email.body}`.toLowerCase();
  if (/\burgent|as soon as possible|deadline|required|denied|resubmit\b/.test(content)) {
    return "NEEDS_ACTION";
  }
  if (index % 11 === 0) return "ARCHIVED";
  if (index % 3 === 0) return "READ";
  return "UNREAD";
}

function loadMockEmails(): CsvEmail[] {
  const dataDirectory = join(process.cwd(), "app", "data");
  const files = ["mock_email_data.csv", "mock_email_data_v2.csv"];

  return files.flatMap((file) => {
    const records = parse(readFileSync(join(dataDirectory, file), "utf-8"), {
      columns: ["sender", "subject", "body"],
      from_line: 2,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    }) as CsvEmail[];

    return records.map((record) => ({
      sender: record.sender.trim(),
      subject: record.subject.trim(),
      body: record.body.trim(),
    }));
  });
}

async function main(prisma: PrismaClient) {
  console.log("🌱  Seeding database with synthetic dummy data…");

  // ------------------------------------------------------------------
  // Reset derived rows so re-running the seed is idempotent.
  // Deletion order follows the foreign keys: Task → Email → Document.
  // Patients are upserted below, keeping their ids stable across runs.
  // ------------------------------------------------------------------
  await prisma.task.deleteMany();
  await prisma.email.deleteMany();
  await prisma.document.deleteMany();

  // ------------------------------------------------------------------
  // Patients — all names, DOBs, and IDs are completely fabricated
  // ------------------------------------------------------------------
  const [alex, maria, james, lisa, david] = await Promise.all([
    prisma.patient.upsert({
      where: { email: "alex.thompson@example-patient.dev" },
      update: {},
      create: {
        firstName: "Alex",
        lastName: "Thompson",
        dob: new Date("1978-03-15"),
        phone: "555-0101",
        email: "alex.thompson@example-patient.dev",
        address: "100 Maple St",
        city: "Anytown",
        state: "CA",
        zip: "90001",
        insurer: "Anthem",
        memberId: "ANT-2024-001",
        authLimit: 24,
        visitsUsed: 6,
        statusNotes: "Active; next auth renewal due 2024-09-01.",
      },
    }),
    prisma.patient.upsert({
      where: { email: "maria.santos@example-patient.dev" },
      update: {},
      create: {
        firstName: "Maria",
        lastName: "Santos",
        dob: new Date("1990-07-22"),
        phone: "555-0102",
        email: "maria.santos@example-patient.dev",
        address: "200 Oak Ave",
        city: "Springfield",
        state: "CA",
        zip: "90002",
        insurer: "Blue Cross",
        memberId: "BCBS-2024-002",
        authLimit: 20,
        visitsUsed: 12,
        statusNotes: "Approaching auth limit; contact insurer by visit 18.",
      },
    }),
    prisma.patient.upsert({
      where: { email: "james.mitchell@example-patient.dev" },
      update: {},
      create: {
        firstName: "James",
        lastName: "Mitchell",
        dob: new Date("1965-11-08"),
        phone: "555-0103",
        email: "james.mitchell@example-patient.dev",
        address: "300 Pine Rd",
        city: "Riverdale",
        state: "CA",
        zip: "90003",
        insurer: "Aetna",
        memberId: "AET-2024-003",
        authLimit: 30,
        visitsUsed: 3,
        statusNotes: null,
      },
    }),
    prisma.patient.upsert({
      where: { email: "lisa.park@example-patient.dev" },
      update: {},
      create: {
        firstName: "Lisa",
        lastName: "Park",
        dob: new Date("1982-05-30"),
        phone: "555-0104",
        email: "lisa.park@example-patient.dev",
        address: "400 Elm Blvd",
        city: "Lakewood",
        state: "CA",
        zip: "90004",
        insurer: "United Health",
        memberId: "UHC-2024-004",
        authLimit: 16,
        visitsUsed: 16,
        statusNotes: "Auth limit reached; authorization request in progress.",
      },
    }),
    prisma.patient.upsert({
      where: { email: "david.rivera@example-patient.dev" },
      update: {},
      create: {
        firstName: "David",
        lastName: "Rivera",
        dob: new Date("1953-09-12"),
        phone: "555-0105",
        email: "david.rivera@example-patient.dev",
        address: "500 Cedar Ln",
        city: "Hillside",
        state: "CA",
        zip: "90005",
        insurer: "Cigna",
        memberId: "CIG-2024-005",
        authLimit: 36,
        visitsUsed: 20,
        statusNotes: "Medicare supplement — verify primary payer each visit.",
      },
    }),
  ]);

  console.log("  ✓ Patients seeded");

  // ------------------------------------------------------------------
  // Documents — fixture PDFs live in public/fixtures/documents/
  // ------------------------------------------------------------------
  const documents = [
    {
      title: "Intake Form 1-1 — Alex Thompson",
      type: "INTAKE_1_1",
      status: "APPROVED",
      fixturePath: `${fixtureBase}/sample-intake-1-1.pdf`,
      patientId: alex.id,
    },
    {
      title: "Intake Form 1-2 — Alex Thompson",
      type: "INTAKE_1_2",
      status: "APPROVED",
      fixturePath: `${fixtureBase}/sample-intake-1-2.pdf`,
      patientId: alex.id,
    },
    {
      title: "Intake Form 1-3 — Alex Thompson",
      type: "INTAKE_1_3",
      status: "PENDING_REVIEW",
      fixturePath: `${fixtureBase}/sample-intake-1-3.pdf`,
      patientId: alex.id,
    },
    {
      title: "SOAP Note 2024-06-01 — Maria Santos",
      type: "SOAP_NOTE",
      status: "APPROVED",
      fixturePath: `${fixtureBase}/sample-soap-note.pdf`,
      patientId: maria.id,
    },
    {
      title: "CMS-1500 Claim — James Mitchell",
      type: "CMS_1500",
      status: "PENDING_REVIEW",
      fixturePath: `${fixtureBase}/sample-cms-1500.pdf`,
      patientId: james.id,
    },
    {
      title: "ASH Medical Necessity Review — Lisa Park",
      type: "ASH_MNR",
      status: "DRAFT",
      fixturePath: `${fixtureBase}/sample-ash-mnr.pdf`,
      patientId: lisa.id,
      notes: "Awaiting visit notes from provider before submission.",
    },
    {
      title: "Personal Injury Report — David Rivera",
      type: "PI_REPORT",
      status: "DRAFT",
      fixturePath: `${fixtureBase}/sample-pi-report.pdf`,
      patientId: david.id,
    },
  ] as const;

  assertFixturesPresent(documents.map((d) => d.fixturePath));

  await prisma.document.createMany({ data: [...documents] });

  console.log("  ✓ Documents seeded");

  // ------------------------------------------------------------------
  // Emails — seeded across the 6 clinic inboxes
  // ------------------------------------------------------------------
  const baseDate = new Date("2024-07-01T09:00:00Z");
  const h = (n: number) => new Date(baseDate.getTime() + n * 3_600_000);

  const [authEmail, claimEmail, referralEmail] = await Promise.all([
    prisma.email.create({
      data: {
        toInbox: "AUTHORIZATIONS",
        fromName: "Anthem Provider Relations",
        fromEmail: "provider.relations@anthem-dummy.example",
        subject: "Auth Request Approved — Alex Thompson / ANT-2024-001",
        body: "We are writing to confirm authorization for 12 additional visits (units 7–18) for member ANT-2024-001. Auth #: AUTH-2024-07-001. Please reference this number on all claims. Questions: 1-800-555-0001.",
        status: "NEEDS_ACTION",
        classification: "AUTHORIZATION",
        insurerLabel: "Anthem",
        receivedAt: h(0),
        patientId: alex.id,
      },
    }),
    prisma.email.create({
      data: {
        toInbox: "CLAIMS",
        fromName: "Aetna Claims Processing",
        fromEmail: "claims@aetna-dummy.example",
        subject: "Claim Denied — James Mitchell / AET-2024-003",
        body: "Claim #CLM-2024-0301 for DOS 2024-06-15 has been denied. Reason: missing diagnosis code on line 21. Please resubmit with corrected CMS-1500. Resubmission deadline: 90 days from DOS. Questions: 1-800-555-0003.",
        status: "NEEDS_ACTION",
        classification: "CLAIM",
        insurerLabel: "Aetna",
        receivedAt: h(2),
        patientId: james.id,
      },
    }),
    prisma.email.create({
      data: {
        toInbox: "REFERRALS",
        fromName: "Dr. Patricia Lee",
        fromEmail: "p.lee@referral-dummy.example",
        subject: "Referral — Maria Santos",
        body: "Please see Maria Santos (DOB on file, BCBS-2024-002) for evaluation and treatment. Diagnosis: cervical strain (M54.2). Requesting up to 12 visits. Please fax results to 555-0200. Thank you.",
        status: "UNREAD",
        classification: "REFERRAL",
        insurerLabel: "Blue Cross",
        receivedAt: h(4),
        patientId: maria.id,
      },
    }),
  ]);

  await prisma.email.createMany({
    data: [
      {
        toInbox: "SCHEDULING",
        fromName: "Lisa Park",
        fromEmail: "lisa.park@example-patient.dev",
        subject: "Appointment Request",
        body: "Hi, I would like to schedule my next appointment. I am available Tuesday and Thursday afternoons. Please let me know what is open. Thank you, Lisa Park.",
        status: "UNREAD",
        classification: "SCHEDULING",
        insurerLabel: "United Health",
        receivedAt: h(5),
        patientId: lisa.id,
      },
      {
        toInbox: "BILLING",
        fromName: "Cigna Billing",
        fromEmail: "billing@cigna-dummy.example",
        subject: "EOB — David Rivera / CIG-2024-005",
        body: "Attached is the Explanation of Benefits for claim CLM-2024-0501 processed 2024-07-01. Patient responsibility: $0.00. Amount paid to provider: $145.00. Questions: 1-800-555-0005.",
        status: "READ",
        classification: "BILLING",
        insurerLabel: "Cigna",
        receivedAt: h(6),
        patientId: david.id,
      },
      {
        toInbox: "INFO",
        fromName: "United Health Provider Line",
        fromEmail: "provider@uhc-dummy.example",
        subject: "Auth Limit Reached — Lisa Park / UHC-2024-004",
        body: "This is a notification that member UHC-2024-004 has reached their authorized visit limit of 16. A new authorization request must be submitted before additional services are rendered. Submit via provider portal or call 1-800-555-0004.",
        status: "NEEDS_ACTION",
        classification: "AUTHORIZATION",
        insurerLabel: "United Health",
        receivedAt: h(8),
        patientId: lisa.id,
      },
    ],
  });

  const mockEmails = loadMockEmails();
  const mockEmailStart = new Date("2024-07-10T08:00:00Z");

  await prisma.email.createMany({
    data: mockEmails.map((email, index) => {
      const toInbox = inferInbox(email, index);
      return {
        toInbox,
        fromName: senderNameFromEmail(email.sender),
        fromEmail: email.sender,
        subject: email.subject,
        body: email.body,
        status: statusForEmail(email, index),
        classification: classificationForInbox(toInbox),
        insurerLabel: inferInsurerLabel(email),
        receivedAt: new Date(mockEmailStart.getTime() + index * 3_600_000),
      };
    }),
  });

  console.log(`  ✓ ${mockEmails.length + 6} emails seeded from clinic fixtures`);

  // ------------------------------------------------------------------
  // Tasks
  // ------------------------------------------------------------------
  await prisma.task.createMany({
    data: [
      {
        title: "Follow up on Anthem auth — Alex Thompson",
        description:
          "Auth #AUTH-2024-07-001 approved. Update chart and schedule visits 7–18.",
        dueDate: new Date("2024-07-05"),
        status: "PENDING",
        patientId: alex.id,
        emailId: authEmail.id,
      },
      {
        title: "Resubmit CMS-1500 — James Mitchell",
        description:
          "Claim denied for missing dx code. Correct and resubmit. Deadline: 90 days from 2024-06-15.",
        dueDate: new Date("2024-07-08"),
        status: "PENDING",
        patientId: james.id,
        emailId: claimEmail.id,
      },
      {
        title: "Process referral — Maria Santos",
        description:
          "Referral from Dr. Lee. Schedule initial evaluation; up to 12 visits authorized.",
        dueDate: new Date("2024-07-05"),
        status: "PENDING",
        patientId: maria.id,
        emailId: referralEmail.id,
      },
      {
        title: "Submit new auth request — Lisa Park",
        description:
          "UHC auth limit of 16 reached. Submit continuation-of-care auth before next appointment.",
        dueDate: new Date("2024-07-04"),
        status: "PENDING",
        patientId: lisa.id,
      },
      {
        title: "Schedule Lisa Park",
        description: "Requested Tue/Thu afternoon slot. Check availability.",
        dueDate: new Date("2024-07-05"),
        status: "PENDING",
        patientId: lisa.id,
      },
      {
        title: "Verify Medicare supplement — David Rivera",
        description:
          "Confirm primary payer for next visit. EOB received; no patient balance.",
        dueDate: new Date("2024-07-10"),
        status: "PENDING",
        patientId: david.id,
      },
    ],
  });

  console.log("  ✓ Tasks seeded");
  console.log("\n✅  Seed complete.");
}

async function run() {
  // Constructed here rather than at module scope so a missing DATABASE_URL
  // reports through the handler below instead of as an import-time stack trace.
  const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL") });
  const prisma = new PrismaClient({ adapter });

  try {
    await main(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n❌  Seed failed.\n\n${message}\n`);
  process.exit(1);
});
