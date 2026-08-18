import { NextResponse } from "next/server";
import { extractPdfText, PdfTextExtractionError } from "@/lib/intake/extractPdfText";
import { parseIntakeFields } from "@/lib/intake/parseIntakeFields";
import { validatePatient, type PatientFields } from "@/lib/validatePatient";

export const runtime = "nodejs";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return error("Upload an intake PDF using the file upload control.", 400);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return error("Choose a non-empty intake PDF to autofill the form.", 400);
    }

    if (
      file.size > MAX_PDF_SIZE_BYTES ||
      (file.type && file.type !== "application/pdf") ||
      (!file.type && !file.name.toLowerCase().endsWith(".pdf"))
    ) {
      return error(
        file.size > MAX_PDF_SIZE_BYTES
          ? "The intake PDF must be 10 MB or smaller."
          : "Only PDF intake files can be uploaded.",
        400,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    if (header !== "%PDF-") {
      return error("The uploaded file is not a valid PDF.", 400);
    }

    const pdfText = await extractPdfText(bytes);
    const fields = parseIntakeFields(pdfText);
    const validationErrors = validatePatient(fields as PatientFields);
    const missingFields = Object.keys(validationErrors);
    const onlyAuthorizationLimitMissing =
      missingFields.length === 1 && missingFields[0] === "authLimit";

    if (missingFields.length > 0 && !onlyAuthorizationLimitMissing) {
      return error(
        "Autofill failed because this intake PDF does not contain all required patient details. Complete the form manually or upload a completed intake PDF.",
        422,
      );
    }

    console.info(`[Intake autofill] completed fields: ${Object.keys(fields).length}`);
    return NextResponse.json({
      fields,
      filledCount: Object.keys(fields).length,
      skippedCount: onlyAuthorizationLimitMissing ? 1 : 0,
      warnings: onlyAuthorizationLimitMissing
        ? ["Authorization limit is not present in this PDF. Enter it manually before saving."]
        : [],
    });
  } catch (cause) {
    if (cause instanceof PdfTextExtractionError) {
      return error(cause.message, 422);
    }

    console.error("Intake autofill failed:", cause);
    return error("Autofill failed. Please try another intake PDF.", 500);
  }
}
