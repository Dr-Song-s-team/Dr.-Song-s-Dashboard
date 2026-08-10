import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getGoogleCalendar,
  buildGoogleReminders,
} from "@/lib/googleCalendar";

type CreateTaskBody = {
  title: string;
  description?: string | null;
  due?: string | null;
  emailId?: string | null;
  patientId?: string | null;
  reminders?: {
    remindAt: string;
  }[];
};

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        patient: true,
        email: true,
        reminders: true,
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    const events = tasks.map((task) => {
      const due = task.dueDate ? new Date(task.dueDate) : null;

      return {
        id: task.id,

        title: task.title,
        description: task.description,

        dueDate: task.dueDate,

        googleEventId: task.googleEventId,

        // Fields your calendar currently expects
        date: due
          ? due.toISOString().split("T")[0]
          : null,

        time: due
          ? due.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
          : null,

        status: task.status,

        patientId: task.patientId,
        patientName: task.patient
          ? `${task.patient.firstName} ${task.patient.lastName}`
          : null,

        // Source email
        emailId: task.emailId,
        email: task.email
          ? {
              id: task.email.id,
              gmailMessageId: task.email.gmailMessageId ?? null,
              gmailThreadId: task.email.gmailThreadId ?? null,
              fromName: task.email.fromName,
              fromEmail: task.email.fromEmail,
              subject: task.email.subject,
              body: task.email.body,
              receivedAt: task.email.receivedAt,
            }
          : null,

        reminders: task.reminders,
      };
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Failed to fetch tasks:", error);

    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body: CreateTaskBody = await req.json();

    const existing = await prisma.task.findFirst({
      where: {
        emailId: body.emailId ?? null,
        title: body.title,
      },
      include: {
        reminders: true,
        patient: true,
        email: true,
      },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    const dueDate = body.due
      ? new Date(body.due)
      : null;

    const event = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        dueDate,
        emailId: body.emailId ?? null,
        patientId: body.patientId ?? null,

        reminders: {
          create: (body.reminders ?? []).map((r) => ({
            remindAt: new Date(r.remindAt),
          })),
        },
      },

      include: {
        reminders: true,
        patient: true,
        email: true,
      },
    });

    /*
     * Create Google Calendar event
     */
    if (dueDate) {
      try {
        const calendar = await getGoogleCalendar();

        const googleEvent = await calendar.events.insert({
          calendarId: "primary",

          requestBody: {
            summary: event.title,
            description: event.description ?? undefined,

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
              event.reminders,
              dueDate
            ),
          },
        });

        if (googleEvent.data.id) {
          await prisma.task.update({
            where: {
              id: event.id,
            },
            data: {
              googleEventId: googleEvent.data.id,
            },
          });
        }
      } catch (calendarError) {
        console.error(
          "Google Calendar creation failed:",
          calendarError
        );

        // The Task still exists locally.
        // Calendar sync can be retried later.
      }
    }

    const finalEvent = await prisma.task.findUnique({
      where: {
        id: event.id,
      },
      include: {
        reminders: true,
        patient: true,
        email: true,
      },
    });

    return NextResponse.json(finalEvent);
  } catch (error) {
    console.error("Failed to create task:", error);

    return NextResponse.json(
      {
        error: "Failed to create task",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}