"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { validatePatient, buildPatientData } from "@/lib/validatePatient";
import { normalizeConfirmationName } from "@/lib/patient/confirmationName";

export type ActionState = {
  errors?: Record<string, string[]>;
  message?: string;
};

function extractFields(formData: FormData) {
  return {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    dob: String(formData.get("dob") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    address: String(formData.get("address") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    zip: String(formData.get("zip") ?? ""),
    insurer: String(formData.get("insurer") ?? ""),
    memberId: String(formData.get("memberId") ?? ""),
    authLimit: String(formData.get("authLimit") ?? ""),
    statusNotes: String(formData.get("statusNotes") ?? ""),
    copay: String(formData.get("copay") ?? ""),
    deductible: String(formData.get("deductible") ?? ""),
    deductibleMet: String(formData.get("deductibleMet") ?? ""),
    paymentStatus: String(formData.get("paymentStatus") ?? ""),
    outstandingBalance: String(formData.get("outstandingBalance") ?? ""),
    lastPaymentDate: String(formData.get("lastPaymentDate") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    services: formData.getAll("services").map(String),
    servicesOther: String(formData.get("servicesOther") ?? ""),
  };
}

function isDuplicateEmailError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

export async function createPatient(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const fields = extractFields(formData);
  const errors = validatePatient(fields);
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    await prisma.patient.create({ data: buildPatientData(fields) });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return {
        errors: { email: ["A patient with this email address already exists."] },
      };
    }
    return { message: "An unexpected error occurred. Please try again." };
  }

  revalidatePath("/info");
  redirect("/info");
}

export async function updatePatient(
  id: string,
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const fields = extractFields(formData);
  const errors = validatePatient(fields);
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    await prisma.patient.update({ where: { id }, data: buildPatientData(fields) });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return {
        errors: { email: ["A patient with this email address already exists."] },
      };
    }
    return { message: "An unexpected error occurred. Please try again." };
  }

  revalidatePath("/info");
  revalidatePath(`/info/${id}`);
  redirect(`/info/${id}`);
}

export async function deletePatient(
  id: string,
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const submittedName = normalizeConfirmationName(
    String(formData.get("confirmName") ?? ""),
  );

  const patient = await prisma.patient.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  });

  if (!patient) {
    return { message: "Patient not found." };
  }

  const expectedName = normalizeConfirmationName(
    `${patient.firstName} ${patient.lastName}`,
  );

  if (submittedName !== expectedName) {
    return {
      message: `The name you entered does not match. Please type "${expectedName}" exactly.`,
    };
  }

  try {
    await prisma.$transaction([
      prisma.document.updateMany({
        where: { patientId: id },
        data: { patientId: null },
      }),
      prisma.email.updateMany({
        where: { patientId: id },
        data: { patientId: null },
      }),
      prisma.patient.delete({ where: { id } }),
    ]);
  } catch {
    return { message: "An unexpected error occurred. Please try again." };
  }

  revalidatePath("/info");
  redirect("/info");
}
