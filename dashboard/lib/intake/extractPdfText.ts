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
    if (!extracted || extracted.trim().length === 0) {
      throw new PdfTextExtractionError(
        "This PDF has no selectable text. Upload a completed text-based intake PDF.",
      );
    }

    return extracted;
  } catch (error) {
    if (error instanceof PdfTextExtractionError) {
      throw error;
    }

    throw new PdfTextExtractionError(
      "We couldn't read this PDF. Upload a valid, text-based intake PDF and try again.",
    );
  }
}
