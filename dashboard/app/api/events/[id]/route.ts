import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getGoogleCalendar,
  buildGoogleReminders,
} from "@/lib/googleCalendar";


export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await req.json();

    const existing = await prisma.task.findUnique({
      where: {
        id,
      },
      include: {
        reminders: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const dueDate = new Date(body.dueDate);

    const updated = await prisma.task.update({
      where: {
        id,
      },

      data: {
        title: body.title,
        description: body.description,
        dueDate,

        reminders: {
          deleteMany: {},

          create: (body.reminders ?? []).map(
            (r: { remindAt: string }) => ({
              remindAt: new Date(r.remindAt),
            })
          ),
        },
      },

      include: {
        patient: true,
        email: true,
        reminders: true,
      },
    });

    /*
     * Update Google Calendar event
     */
    if (existing.googleEventId) {
      try {
        const calendar = await getGoogleCalendar();

        await calendar.events.update({
          calendarId: "primary",
          eventId: existing.googleEventId,

          requestBody: {
            summary: updated.title,
            description:
              updated.description ?? undefined,

            start: {
              dateTime: dueDate.toISOString(),
              timeZone: "America/Los_Angeles",
            },

            end: {
              dateTime: new Date(
                dueDate.getTime() + 30 * 60 * 1000
              ).toISOString(),
              timeZone: "America/Los_Angeles",
            },

            reminders: buildGoogleReminders(
              updated.reminders,
              dueDate
            ),
          },
        });
      } catch (calendarError) {
        console.error(
          "Google Calendar update failed:",
          calendarError
        );
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update task:", error);

    return NextResponse.json(
      {
        error: "Failed to update task",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: {
        id,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    /*
     * Delete Google Calendar event first
     */
    if (task.googleEventId) {
      try {
        const calendar = await getGoogleCalendar();

        await calendar.events.delete({
          calendarId: "primary",
          eventId: task.googleEventId,
        });
      } catch (calendarError: any) {
        /*
         * If Google says the event doesn't exist anymore,
         * that's okay.
         */
        if (calendarError?.code !== 404) {
          console.error(
            "Google Calendar deletion failed:",
            calendarError
          );

          return NextResponse.json(
            {
              error:
                "Failed to delete Google Calendar event",
            },
            { status: 500 }
          );
        }
      }
    }

    /*
     * Delete local Task.
     *
     * Reminder rows cascade because your schema has:
     *
     * onDelete: Cascade
     */
    await prisma.task.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Failed to delete task:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to delete task",
      },
      { status: 500 }
    );
  }
}