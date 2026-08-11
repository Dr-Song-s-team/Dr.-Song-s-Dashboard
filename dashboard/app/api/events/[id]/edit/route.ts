import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getGoogleCalendar,
  buildGoogleReminders,
} from "@/lib/googleCalendar";

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

    // Only tasks awaiting review can be edited
    if (
      existingTask.extractionStatus !==
      "PENDING_REVIEW"
    ) {
      return NextResponse.json(
        {
          error:
            "Task is no longer awaiting review",
        },
        { status: 400 }
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

    const parsedDueDate = dueDate
      ? new Date(dueDate)
      : null;

    if (
      parsedDueDate &&
      Number.isNaN(parsedDueDate.getTime())
    ) {
      return NextResponse.json(
        {
          error: "Invalid due date",
        },
        { status: 400 }
      );
    }

    // Update the task first.
    const updatedTask =
      await prisma.task.update({
        where: {
          id,
        },
        data: {
          title: title.trim(),
          description:
            summary?.trim() || null,
          dueDate: parsedDueDate,
          patientId,

          // Manually edited by the user
          extractionStatus: "EDITED",
          status: "PENDING",
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

    /*
     * Create the Google Calendar event AFTER
     * the task has been successfully edited.
     */
    if (updatedTask.dueDate) {
      try {
        const calendar =
          await getGoogleCalendar();

        const googleEvent =
          await calendar.events.insert({
            calendarId: "primary",

            requestBody: {
              summary: updatedTask.title,

              description:
                updatedTask.description ??
                undefined,

              start: {
                dateTime:
                  updatedTask.dueDate.toISOString(),
                timeZone:
                  "America/Los_Angeles",
              },

              end: {
                dateTime: new Date(
                  updatedTask.dueDate.getTime() +
                    30 * 60 * 1000
                ).toISOString(),
                timeZone:
                  "America/Los_Angeles",
              },

              reminders: buildGoogleReminders(
                updatedTask.reminders,
                updatedTask.dueDate
              ),
            },
          });

        if (googleEvent.data.id) {
          const taskWithGoogleEvent =
            await prisma.task.update({
              where: {
                id: updatedTask.id,
              },
              data: {
                googleEventId:
                  googleEvent.data.id,
              },
              include: {
                patient: true,
                email: true,
                reminders: true,
              },
            });

          console.log(
            "GOOGLE CALENDAR EVENT CREATED:",
            googleEvent.data.id
          );

          return NextResponse.json(
            taskWithGoogleEvent
          );
        }
      } catch (calendarError) {
        console.error(
          "Google Calendar creation failed:",
          calendarError
        );

        // The task remains EDITED locally.
        // Calendar failure should not undo the user's edit.
      }
    }

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