/**
 * POST /api/insurance/autofill
 *
 * AI-powered insurance form autofill endpoint.
 *
 * Input: { formType: string, patientId: string }
 * Output: { fields: Record<string, string>, filledCount: number, skippedCount: number }
 *
 * Pipeline:
 * 1. Load patient + documents/emails from Prisma
 * 2. Build prompt with aiFillable field definitions + patient context
 * 3. redact(context) → callAI with jsonMode: true → unredact response → scanText()
 * 4. Return filled fields with metadata
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FORM_TEMPLATES } from "@/lib/insurance/templates";
import { loadEntities, redact, unredact, scanText } from "@/lib/redaction";
import { callAI } from "@/lib/ai/provider";
import { sanitizeAutofillValue } from "@/lib/insurance/sanitizeAutofillValue";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { formType, patientId } = body;

    // Validate inputs
    if (!formType || typeof formType !== "string") {
      return NextResponse.json(
        { error: "formType is required and must be a string" },
        { status: 400 }
      );
    }

    if (!patientId || typeof patientId !== "string") {
      return NextResponse.json(
        { error: "patientId is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate form template exists
    const template = FORM_TEMPLATES[formType];
    if (!template) {
      return NextResponse.json(
        { error: `Invalid formType: ${formType}` },
        { status: 400 }
      );
    }

    // Load patient with documents and emails
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        documents: {
          orderBy: { createdAt: "desc" },
          take: 10, // Last 10 documents for context
        },
        emails: {
          orderBy: { receivedAt: "desc" },
          take: 10, // Last 10 emails for context
        },
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: `Patient not found: ${patientId}` },
        { status: 404 }
      );
    }

    // Build patient context string
    const patientContext = `
Patient Information:
- Name: ${patient.firstName} ${patient.lastName}
- DOB: ${patient.dob.toISOString().split("T")[0]}
- Phone: ${patient.phone}
- Email: ${patient.email}
- Address: ${patient.address}, ${patient.city}, ${patient.state} ${patient.zip}
- Insurer: ${patient.insurer}
- Member ID: ${patient.memberId}
- Auth Limit: ${patient.authLimit} visits
- Visits Used: ${patient.visitsUsed}
${patient.statusNotes ? `- Status Notes: ${patient.statusNotes}` : ""}

Recent Documents (${patient.documents.length}):
${patient.documents.map((doc, i) => `${i + 1}. [${doc.type}] ${doc.title}${doc.notes ? ` - ${doc.notes}` : ""}`).join("\n")}

Recent Emails (${patient.emails.length}):
${patient.emails.map((email, i) => `${i + 1}. From: ${email.fromName} <${email.fromEmail}>
   Subject: ${email.subject}
   Date: ${email.receivedAt.toISOString().split("T")[0]}
   Body: ${email.body.substring(0, 500)}${email.body.length > 500 ? "..." : ""}
   ${email.aiSummary ? `Summary: ${email.aiSummary}` : ""}`).join("\n\n")}
`.trim();

    // Extract aiFillable fields
    const aiFillableFields = template.fields.filter((f) => f.aiFillable);

    // Build field definitions for AI prompt
    const fieldDefinitions = aiFillableFields.map((f) => {
      const def: Record<string, unknown> = {
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
      };
      if (f.options) {
        def.options = f.options;
      }
      if (f.placeholder) {
        def.placeholder = f.placeholder;
      }
      return def;
    });

    // Build AI system prompt
    const systemPrompt = `You are a medical office assistant helping to fill insurance forms.

CRITICAL RULES ABOUT PRIVACY PLACEHOLDERS:
The patient context contains privacy placeholders in the format {{TYPE_N}} (e.g., {{PATIENT_NAME_17}}, {{DOB_5}}, {{EMAIL_1}}).
These placeholders ARE the actual values — copy the exact placeholder string into the corresponding field.

Examples:
- If context says "Name: {{PATIENT_NAME_17}}", set patientFirstName to "{{PATIENT_NAME_17}}"
- If context says "DOB: {{DOB_5}}", set patientDOB to "{{DOB_5}}"
- If context says "Phone: {{PHONE_3}}", set patientPhone to "{{PHONE_3}}"

NEVER leave a field null just because it contains a placeholder token. Copy the placeholder exactly.

RULES FOR MISSING DATA:
1. If you cannot determine a field value from the context, simply OMIT that field from your JSON response
2. NEVER use placeholder values like "null", "N/A", "unknown", "none", or "undefined" as field values
3. NEVER invent diagnosis codes, CPT codes, or clinical information not present in context
4. For date fields, use YYYY-MM-DD format (or the placeholder token if date is redacted)
5. For diagnosis/CPT codes, only use codes explicitly mentioned in documents or emails
6. For clinical narratives, only summarize information explicitly present in context

Form type: ${template.title}

Fields to fill:
${JSON.stringify(fieldDefinitions, null, 2)}

Return a JSON object with field keys as properties. Use null for unknown fields.
Example: { "patientFirstName": "{{PATIENT_NAME_17}}", "patientDOB": "{{DOB_5}}", "diagnosisCodes": null }`;

    // Pipeline: redact → callAI → unredact → scanText
    const entities = await loadEntities();
    const { redactedText: redactedContext, tokenMap } = redact(
      patientContext,
      entities
    );

    // Build redacted user prompt
    const userPrompt = `${redactedContext}

Fill the form fields based on the above patient context. Return valid JSON only.`;

    const { redactedText: redactedPrompt } = redact(userPrompt, entities);

    // Call AI with JSON mode
    const aiResponse = await callAI(redactedPrompt, {
      systemPrompt,
      temperature: 0.3, // Low temperature for factual responses
      jsonMode: true,
    });

    // Parse JSON response (still redacted at this point)
    let parsedFields: Record<string, string | null>;
    try {
      parsedFields = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      console.error("AI response:", aiResponse);
      return NextResponse.json(
        { error: "AI returned invalid JSON response" },
        { status: 500 }
      );
    }

    // Unredact and sanitize each field value
    const unredactedFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsedFields)) {
      if (value !== null && value !== undefined && value !== "") {
        const { originalText } = unredact(String(value), tokenMap);
        // Sanitize to remove "null", "N/A", "unknown" placeholder strings
        const sanitized = sanitizeAutofillValue(originalText);
        if (sanitized !== null) {
          unredactedFields[key] = sanitized;
        }
      }
    }

    // Handle name splitting: if patientFirstName contains a full name, split it
    // Also handle case where both firstName and lastName are identical (AI copied same token to both)
    if (unredactedFields.patientFirstName) {
      const firstName = unredactedFields.patientFirstName;
      const lastName = unredactedFields.patientLastName;

      // Split if lastName is null OR if firstName === lastName (duplicate)
      if (!lastName || firstName === lastName) {
        const parts = firstName.trim().split(/\s+/);
        if (parts.length >= 2) {
          unredactedFields.patientFirstName = parts[0];
          unredactedFields.patientLastName = parts.slice(1).join(" ");
        }
      }
    }

    // Handle address splitting: if patientAddress contains full address with city/state/zip, split it
    // Also handle case where address === city (AI copied same token to both)
    if (unredactedFields.patientAddress) {
      const address = unredactedFields.patientAddress;
      const city = unredactedFields.patientCity;

      // First check if address === city (duplicate) - if so, city is likely wrong, clear it
      if (city && address === city) {
        unredactedFields.patientCity = "";
      }

      // Now try to split full address pattern: "Street, City, ST 12345"
      const match = address.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (match) {
        const [, street, extractedCity, state, zip] = match;
        unredactedFields.patientAddress = street.trim();
        // Only overwrite city/state/zip if they came back null or were cleared
        if (!unredactedFields.patientCity) {
          unredactedFields.patientCity = extractedCity.trim();
        }
        if (!unredactedFields.patientState) {
          unredactedFields.patientState = state;
        }
        if (!unredactedFields.patientZip) {
          unredactedFields.patientZip = zip;
        }
      }
    }

    // Handle city/state/zip splitting: if patientCity contains "City, ST 12345" pattern, split it
    if (unredactedFields.patientCity) {
      const cityStateZip = unredactedFields.patientCity;
      // Match pattern: "City, ST 12345" or "City, ST ZIP"
      const match = cityStateZip.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (match) {
        const [, city, state, zip] = match;
        unredactedFields.patientCity = city.trim();
        // Only overwrite state/zip if they came back null
        if (!unredactedFields.patientState) {
          unredactedFields.patientState = state;
        }
        if (!unredactedFields.patientZip) {
          unredactedFields.patientZip = zip;
        }
      }
    }

    // Filter out null values and ensure all values are strings
    const fields: Record<string, string> = {};
    let filledCount = 0;
    let skippedCount = 0;

    for (const field of aiFillableFields) {
      const value = unredactedFields[field.key];
      if (value !== null && value !== undefined && value !== "") {
        fields[field.key] = String(value);
        filledCount++;
      } else {
        skippedCount++;
      }
    }

    // Scan all final values for PII leaks
    for (const value of Object.values(fields)) {
      scanText(value);
    }

    // Log fill stats for monitoring
    console.log(`[Autofill] ${template.type} - Filled: ${filledCount}, Skipped: ${skippedCount}`);

    return NextResponse.json({
      fields,
      filledCount,
      skippedCount,
    });
  } catch (error) {
    console.error("Autofill error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
