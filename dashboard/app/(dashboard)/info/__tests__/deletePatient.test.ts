import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Next.js server utilities before importing actions
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    patient: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    document: {
      updateMany: vi.fn(),
    },
    email: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Import after mocks are set up
import { deletePatient } from "../actions";
import { normalizeConfirmationName } from "@/lib/patient/confirmationName";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const PATIENT_ID = "patient-abc";
const FIRST_NAME = "Jane";
const LAST_NAME = "Doe";
const FULL_NAME = `${FIRST_NAME} ${LAST_NAME}`;

function makeFormData(confirmName: string): FormData {
  const fd = new FormData();
  fd.set("confirmName", confirmName);
  return fd;
}

describe("normalizeConfirmationName", () => {
  it("trims leading/trailing whitespace", () => {
    expect(normalizeConfirmationName("  Jane Doe  ")).toBe("Jane Doe");
  });

  it("collapses interior whitespace to a single space", () => {
    expect(normalizeConfirmationName("Jane  Doe")).toBe("Jane Doe");
  });

  it("does not change case", () => {
    expect(normalizeConfirmationName("jane doe")).toBe("jane doe");
  });
});

describe("deletePatient server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an error when patient is not found", async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(null);

    const result = await deletePatient(PATIENT_ID, {}, makeFormData(FULL_NAME));

    expect(result).toEqual({ message: "Patient not found." });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns an error when the confirmation name does not match", async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
    } as never);

    const result = await deletePatient(PATIENT_ID, {}, makeFormData("Wrong Name"));

    expect(result.message).toMatch(/does not match/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns an error for case mismatch", async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
    } as never);

    const result = await deletePatient(PATIENT_ID, {}, makeFormData("jane doe"));

    expect(result.message).toMatch(/does not match/i);
  });

  it("runs the transaction and redirects on success", async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
    } as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    await expect(
      deletePatient(PATIENT_ID, {}, makeFormData(FULL_NAME)),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/info");
    expect(redirect).toHaveBeenCalledWith("/info");
  });

  it("returns an error when the transaction throws", async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
    } as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("db error"));

    const result = await deletePatient(PATIENT_ID, {}, makeFormData(FULL_NAME));

    expect(result).toEqual({
      message: "An unexpected error occurred. Please try again.",
    });
  });

  it("accepts name with leading/trailing whitespace", async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
    } as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    await expect(
      deletePatient(PATIENT_ID, {}, makeFormData(`  ${FULL_NAME}  `)),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
