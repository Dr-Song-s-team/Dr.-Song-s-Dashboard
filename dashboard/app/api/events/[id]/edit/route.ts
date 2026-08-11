import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Read the body safely
    const rawBody = await request.text();

    console.log("EDIT TASK RAW BODY:", rawBody);

    if (!rawBody.trim()) {
      return NextResponse.json(
        {
          error: "Request body is empty",
        },
        { status: 400 }
      );
    }

    let body: {
      title?: string;
      summary?: string | null;
      dueDate?: string | null;
      patientName?: string | null;
    };

    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error(
        "EDIT TASK JSON PARSE ERROR:",
        parseError
      );

      return NextResponse.json(
        {
          error: "Invalid JSON request body",
          details:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        },
        { status: 400 }
      );
    }

    console.log("EDIT TASK BODY:", body);

    const {
      title,
      summary,
      dueDate,
      patientName,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        {
          error: "Title is required",
        },
        { status: 400 }
      );
    }

    // Find the existing task
    const existingTask = await prisma.task.findUnique({
      where: {
        id,
      },
      include: {
        patient: true,
        email: true,
      },
    });

    if (!existingTask) {
      return NextResponse.json(
        {
          error: "Task not found",
        },
        { status: 404 }
      );
    }

    // Find patient if a patient name was supplied
    let patientId: string | null =
      existingTask.patientId;

    if (patientName && patientName.trim()) {
      const parts = patientName
        .trim()
        .split(/\s+/);

      if (parts.length >= 2) {
        const firstName = parts[0];
        const lastName = parts
          .slice(1)
          .join(" ");

        const patient =
          await prisma.patient.findFirst({
            where: {
              firstName: {
                equals: firstName,
                mode: "insensitive",
              },
              lastName: {
                equals: lastName,
                mode: "insensitive",
              },
            },
          });

        if (patient) {
          patientId = patient.id;
        }
      }
    } else if (patientName === null) {
      patientId = null;
    }

    const updatedTask = await prisma.task.update({
      where: {
        id,
      },
      data: {
        title: title.trim(),
        description: summary?.trim() || null,
        dueDate: dueDate
          ? new Date(dueDate)
          : null,
        patientId,

        // THIS is what marks it as manually edited
        extractionStatus: "EDITED",
      },
      include: {
        patient: true,
        email: true,
        reminders: true,
      },
    });

    console.log(
      "EDIT TASK SUCCESS:",
      updatedTask.id
    );

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error(
      "EDIT TASK ROUTE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to edit recommended task",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}