import { extractText, getDocumentProxy } from "unpdf";

export class PdfTextExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfTextExtractionError";
  }
}

/**
 * Extract selectable text from a PDF. Image-only scans are deliberately not
 * supported because this application does not currently include an OCR service.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });

    const extracted = Array.isArray(text) ? text.join("\n") : text;
    const formFields: string[] = [];
    // Track emitted field names across all pages so that radio-button groups
    // (whose parent value is repeated once per child widget) and duplicate
    // annotations produce only a single line each.
    const seenFieldNames = new Set<string>();
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const annotations = await page.getAnnotations();

      for (const annotation of annotations) {
        if (annotation.subtype !== "Widget" || !annotation.fieldName) continue;
        if (seenFieldNames.has(annotation.fieldName)) continue;

        const value = Array.isArray(annotation.fieldValue)
          ? annotation.fieldValue.join(", ")
          : annotation.fieldValue;
        if (typeof value === "string" && value.trim() && value !== "Off") {
          formFields.push(`PDF form field ${annotation.fieldName}: ${value.trim()}`);
          seenFieldNames.add(annotation.fieldName);
        }
      }
    }

    const combined = [extracted?.trim(), ...formFields].filter(Boolean).join("\n");
    if (!combined) {
      throw new PdfTextExtractionError(
        "This PDF has no selectable text. Upload a completed text-based intake PDF.",
      );
    }

    return combined;
  } catch (error) {
    if (error instanceof PdfTextExtractionError) {
      throw error;
    }

    throw new PdfTextExtractionError(
      "We couldn't read this PDF. Upload a valid, text-based intake PDF and try again.",
    );
  }
}
