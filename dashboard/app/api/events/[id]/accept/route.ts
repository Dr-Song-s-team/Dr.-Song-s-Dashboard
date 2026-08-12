import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getGoogleCalendar,
  buildGoogleReminders,
} from "@/lib/googleCalendar";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        reminders: true,
        patient: true,
        email: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    if (
      task.extractionStatus !== "PENDING_REVIEW"
    ) {
      return NextResponse.json(
        {
          error:
            "Task is no longer awaiting review",
        },
        { status: 400 }
      );
    }

    const updated = await prisma.task.update({
      where: { id },

      data: {
        extractionStatus: "ACCEPTED",
        status: "PENDING",
      },

      include: {
        patient: true,
        email: true,
        reminders: true,
      },
    });

    if (updated.dueDate) {
      try {
        const calendar = await getGoogleCalendar();

        const googleEvent =
          await calendar.events.insert({
            calendarId: "primary",

            requestBody: {
              summary: updated.title,

              description:
                updated.description ??
                undefined,

              start: {
                dateTime:
                  updated.dueDate.toISOString(),
                timeZone:
                  "America/Los_Angeles",
              },

              end: {
                dateTime: new Date(
                  updated.dueDate.getTime() +
                    30 * 60 * 1000
                ).toISOString(),

                timeZone:
                  "America/Los_Angeles",
              },

              reminders: buildGoogleReminders(
                updated.reminders,
                updated.dueDate
              ),
            },
          });

        if (googleEvent.data.id) {
          await prisma.task.update({
            where: {
              id: updated.id,
            },

            data: {
              googleEventId:
                googleEvent.data.id,
            },
          });

          updated.googleEventId =
            googleEvent.data.id;
        }
      } catch (calendarError) {
        console.error(
          "Google Calendar creation failed:",
          calendarError
        );

        // The task is still accepted locally.
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error(
      "Failed to accept recommended task:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to accept recommended task",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}