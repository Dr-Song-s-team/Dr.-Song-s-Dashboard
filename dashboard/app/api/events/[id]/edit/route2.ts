import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface EditRequest {
  title?: string;
  summary?: string;
  dueDate?: string | null;
  patientName?: string | null;
}

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;

    const body =
      (await request.json()) as EditRequest;

    const {
      title,
      summary,
      dueDate,
      patientName,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        {
          error: "Title is required",
        },
        { status: 400 }
      );
    }

    const existingTask =
      await prisma.task.findUnique({
        where: {
          id,
        },
        include: {
          patient: true,
          email: true,
          reminders: true,
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

    let patientId =
      existingTask.patientId;

    /*
     * If the user changed the patient name,
     * try to find the corresponding patient.
     */
    if (
      patientName &&
      patientName.trim() !== ""
    ) {
      const nameParts =
        patientName.trim().split(/\s+/);

      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName =
          nameParts.slice(1).join(" ");

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
    }

    const updatedTask =
      await prisma.task.update({
        where: {
          id,
        },

        data: {
          title: title.trim(),

          description:
            summary?.trim() || null,

          dueDate: dueDate
            ? new Date(dueDate)
            : null,

          patientId,

          // THIS is the important part:
          extractionStatus: "EDITED",
        },

        include: {
          patient: true,
          email: true,
          reminders: true,
        },
      });

    return NextResponse.json(
      updatedTask,
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Failed to edit recommended task:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to edit recommended task",
      },
      { status: 500 }
    );
  }
}