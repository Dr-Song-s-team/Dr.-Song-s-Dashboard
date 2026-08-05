/**
 * POST /api/insurance/save
 *
 * Save insurance form as a Document with DRAFT status.
 * Form data is stored in the notes field as JSON.
 *
 * Input: { formType: string, patientId: string, formData: Record<string, string> }
 * Output: { documentId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FORM_TEMPLATES } from "@/lib/insurance/templates";
import { DocumentType } from "@/app/generated/prisma/client";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { formType, patientId, formData } = body;

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

    if (!formData || typeof formData !== "object") {
      return NextResponse.json(
        { error: "formData is required and must be an object" },
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

    // Ensure formType is a valid DocumentType
    if (!Object.values(DocumentType).includes(formType as DocumentType)) {
      return NextResponse.json(
        { error: `formType ${formType} is not a valid DocumentType` },
        { status: 400 }
      );
    }

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return NextResponse.json(
        { error: `Patient not found: ${patientId}` },
        { status: 404 }
      );
    }

    // Create document with form data in notes field
    const document = await prisma.document.create({
      data: {
        type: formType as DocumentType,
        status: "DRAFT",
        title: `${template.title} - DRAFT`,
        fixturePath: "", // No PDF yet, will be generated later
        notes: JSON.stringify(formData, null, 2),
        patientId,
      },
    });

    return NextResponse.json({ documentId: document.id });
  } catch (error) {
    console.error("Save error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
