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
});
