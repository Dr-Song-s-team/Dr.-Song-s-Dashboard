import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseIntakeFields } from "../intake/parseIntakeFields.ts";

const COMPLETED_INTAKE = `
First Name: Alex
Last Name: Thompson
Date of Birth: 03/15/1978
Mobile Phone: 555-0101
Email: alex.thompson@example-patient.dev
Street Address: 100 Maple St
City: Anytown
State: ca
Zip Code: 90001
Primary Insurance Company: Anthem
Member ID: ANT-2024-001
Authorization Visit Limit: 24
Status Notes: Active; next auth renewal due 2024-09-01.
`;

describe("parseIntakeFields", () => {
  test("maps a completed intake into patient form fields", () => {
    assert.deepEqual(parseIntakeFields(COMPLETED_INTAKE), {
      firstName: "Alex",
      lastName: "Thompson",
      dob: "1978-03-15",
      phone: "555-0101",
      email: "alex.thompson@example-patient.dev",
      address: "100 Maple St",
      city: "Anytown",
      state: "CA",
      zip: "90001",
      insurer: "Anthem",
      memberId: "ANT-2024-001",
      authLimit: "24",
      statusNotes: "Active; next auth renewal due 2024-09-01.",
    });
  });

  test("does not invent values from a blank form template", () => {
    const fields = parseIntakeFields(`
      First Name:              Last Name:             Date of Birth: M/D/YYYY
      Mobile Phone:            Email:
      Primary Insurance Company:       Member ID / Policy #:
    `);

    assert.deepEqual(fields, {});
  });

  test("maps populated AcroForm widget values without replacing label parsing", () => {
    const fields = parseIntakeFields(`
      PATIENT INFORMATION
      First Name * Last Name * Date of Birth (MM/DD/YYYY) *
      Email Street Address Apt/Unit # City State Zip Code Mobile Phone *
      INSURANCE
      Primary Insurance Company Member ID / Policy #
      PDF form field patient.first_name: Avery
      PDF form field patient.last_name: Tester
      PDF form field patient.dob: 04/15/1992
      PDF form field patient.email: avery.tester@example.com
      PDF form field patient.street_address: 100 Example Avenue
      PDF form field patient.apt_unit: Unit 2B
      PDF form field patient.city: Testville
      PDF form field patient.state: CA
      PDF form field patient.zip: 90000
      PDF form field patient.mobile_phone: (555) 010-1001
      PDF form field insurance.primary.company: Example Health Plan
      PDF form field insurance.primary.member_id: TEST-MEMBER-001
    `);

    assert.deepEqual(fields, {
      firstName: "Avery",
      lastName: "Tester",
      dob: "1992-04-15",
      phone: "(555) 010-1001",
      email: "avery.tester@example.com",
      address: "100 Example Avenue, Unit 2B",
      city: "Testville",
      state: "CA",
      zip: "90000",
      insurer: "Example Health Plan",
      memberId: "TEST-MEMBER-001",
    });
  });

  test("maps Dr. Song multilingual AcroForm field names (patient_en.* / insurance_primary.*)", () => {
    // Simulates the extracted text from a Dr. Song intake form where visible
    // labels and values appear on separate lines (layout PDFs) and the AcroForm
    // uses a different naming scheme from the canonical patient.* scheme.
    const fields = parseIntakeFields(`
      First Name: * Middle Initials: Last Name: * Date of Birth: *
      Street Address: Apt./Unit #:
      City: State: Zip Code:
      Mobile Phone: * Home Phone: Work Phone:
      Email:
      Primary Insurance Company Member ID / Policy #
      PDF form field patient_en.first_name: Jordan
      PDF form field patient_en.middle_initials: R
      PDF form field patient_en.last_name: Rivera
      PDF form field patient_en.date_of_birth: 06/20/1985
      PDF form field patient_en.street_address: 42 Wellness Way
      PDF form field patient_en.apt_unit: Suite 3
      PDF form field patient_en.city: Springfield
      PDF form field patient_en.state: OR
      PDF form field patient_en.zip_code: 97401
      PDF form field patient_en.mobile_phone: (503) 555-0199
      PDF form field patient_en.email: jordan.rivera@example-patient.dev
      PDF form field insurance_primary.text_109: Pacific Health Partners
      PDF form field insurance_primary.id: PHP-2026-88801
    `);

    assert.deepEqual(fields, {
      firstName: "Jordan",
      lastName: "Rivera",
      dob: "1985-06-20",
      phone: "(503) 555-0199",
      email: "jordan.rivera@example-patient.dev",
      address: "42 Wellness Way, Suite 3",
      city: "Springfield",
      state: "OR",
      zip: "97401",
      insurer: "Pacific Health Partners",
      memberId: "PHP-2026-88801",
    });
  });

  test("canonical fields take priority when both canonical and patient_en fields are present", () => {
    const fields = parseIntakeFields(`
      PDF form field patient.first_name: Canonical
      PDF form field patient_en.first_name: DrSong
      PDF form field patient.last_name: Form
      PDF form field patient.dob: 01/01/1990
      PDF form field patient.email: canonical@example.com
      PDF form field patient.street_address: 1 Canonical St
      PDF form field patient.city: Portland
      PDF form field patient.state: OR
      PDF form field patient.zip: 97201
      PDF form field patient.mobile_phone: (503) 555-0100
      PDF form field insurance.primary.company: Canonical Insurer
      PDF form field insurance.primary.member_id: CAN-001
    `);

    assert.equal(fields.firstName, "Canonical");
  });
});
