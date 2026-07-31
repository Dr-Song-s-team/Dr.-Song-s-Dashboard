/**
 * Unit tests for lib/validatePatient using Node.js built-in test runner.
 * Run with: node --experimental-strip-types --test lib/__tests__/validatePatient.test.mjs
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validatePatient, buildPatientData } from "../validatePatient.ts";

const VALID = {
  firstName: "Alex",
  lastName: "Thompson",
  dob: "1978-03-15",
  phone: "555-0101",
  email: "alex@example.com",
  address: "100 Maple St",
  city: "Anytown",
  state: "CA",
  zip: "90001",
  insurer: "Anthem",
  memberId: "ANT-001",
  authLimit: "24",
  statusNotes: "",
};

describe("validatePatient — required fields", () => {
  test("returns no errors for a fully valid record", () => {
    const errors = validatePatient(VALID);
    assert.deepEqual(errors, {});
  });

  test("flags missing firstName", () => {
    const errors = validatePatient({ ...VALID, firstName: "" });
    assert.ok(errors.firstName, "firstName error expected");
  });

  test("flags missing lastName", () => {
    const errors = validatePatient({ ...VALID, lastName: "   " });
    assert.ok(errors.lastName, "lastName error expected");
  });

  test("flags missing email", () => {
    const errors = validatePatient({ ...VALID, email: "" });
    assert.ok(errors.email, "email error expected");
  });

  test("flags missing dob", () => {
    const errors = validatePatient({ ...VALID, dob: "" });
    assert.ok(errors.dob, "dob error expected");
  });

  test("flags missing authLimit", () => {
    const errors = validatePatient({ ...VALID, authLimit: "" });
    assert.ok(errors.authLimit, "authLimit error expected");
  });
});

describe("validatePatient — email format", () => {
  test("rejects malformed email", () => {
    const errors = validatePatient({ ...VALID, email: "not-an-email" });
    assert.ok(errors.email);
    assert.match(errors.email[0], /valid email/i);
  });

  test("accepts standard email format", () => {
    const errors = validatePatient({ ...VALID, email: "user@clinic.org" });
    assert.equal(errors.email, undefined);
  });
});

describe("validatePatient — date of birth", () => {
  test("rejects a future date", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const errors = validatePatient({
      ...VALID,
      dob: future.toISOString().split("T")[0],
    });
    assert.ok(errors.dob);
    assert.match(errors.dob[0], /future/i);
  });

  test("rejects an unparseable date", () => {
    const errors = validatePatient({ ...VALID, dob: "not-a-date" });
    assert.ok(errors.dob);
  });

  test("accepts a valid past date", () => {
    const errors = validatePatient({ ...VALID, dob: "1990-06-15" });
    assert.equal(errors.dob, undefined);
  });
});

describe("validatePatient — state", () => {
  test("rejects state longer than 2 chars", () => {
    const errors = validatePatient({ ...VALID, state: "CAL" });
    assert.ok(errors.state);
  });

  test("rejects numeric state", () => {
    const errors = validatePatient({ ...VALID, state: "12" });
    assert.ok(errors.state);
  });

  test("accepts valid 2-letter state", () => {
    const errors = validatePatient({ ...VALID, state: "NY" });
    assert.equal(errors.state, undefined);
  });
});

describe("validatePatient — ZIP code", () => {
  test("rejects non-numeric ZIP", () => {
    const errors = validatePatient({ ...VALID, zip: "9000A" });
    assert.ok(errors.zip);
  });

  test("rejects ZIP shorter than 5", () => {
    const errors = validatePatient({ ...VALID, zip: "9000" });
    assert.ok(errors.zip);
  });

  test("accepts 5-digit ZIP", () => {
    const errors = validatePatient({ ...VALID, zip: "90001" });
    assert.equal(errors.zip, undefined);
  });

  test("accepts 9-digit ZIP+4", () => {
    const errors = validatePatient({ ...VALID, zip: "90001-1234" });
    assert.equal(errors.zip, undefined);
  });
});

describe("validatePatient — authLimit", () => {
  test("rejects negative authorization limit", () => {
    const errors = validatePatient({ ...VALID, authLimit: "-5" });
    assert.ok(errors.authLimit);
  });

  test("rejects non-numeric authorization limit", () => {
    const errors = validatePatient({ ...VALID, authLimit: "abc" });
    assert.ok(errors.authLimit);
  });

  test("accepts zero", () => {
    const errors = validatePatient({ ...VALID, authLimit: "0" });
    assert.equal(errors.authLimit, undefined);
  });
});

describe("buildPatientData", () => {
  test("normalises email to lowercase", () => {
    const data = buildPatientData({ ...VALID, email: "Alex@Example.COM" });
    assert.equal(data.email, "alex@example.com");
  });

  test("normalises state to uppercase", () => {
    const data = buildPatientData({ ...VALID, state: "ca" });
    assert.equal(data.state, "CA");
  });

  test("parses authLimit as integer", () => {
    const data = buildPatientData({ ...VALID, authLimit: "24" });
    assert.equal(data.authLimit, 24);
    assert.equal(typeof data.authLimit, "number");
  });

  test("converts dob string to Date", () => {
    const data = buildPatientData(VALID);
    assert.ok(data.dob instanceof Date);
    assert.ok(!isNaN(data.dob.getTime()));
  });

  test("coerces empty statusNotes to null", () => {
    const data = buildPatientData({ ...VALID, statusNotes: "   " });
    assert.equal(data.statusNotes, null);
  });

  test("preserves non-empty statusNotes", () => {
    const data = buildPatientData({ ...VALID, statusNotes: "Active patient." });
    assert.equal(data.statusNotes, "Active patient.");
  });
});
