import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
          ? task.patient.name
          : null,

        // Source email
        emailId: task.emailId,
        email: task.email
          ? {
              id: task.email.id,
              gmailMessageId: task.email.gmailMessageId,
              gmailThreadId: task.email.gmailThreadId,
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
    const body = await req.json();

    const existing = await prisma.task.findFirst({
      where: {
        emailId: body.emailId ?? null,
        title: body.title,
      },
      include: {
        reminders: true,
        patient: true,
        email: true,
      }
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    const event = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description ?? null,

        dueDate: body.due
          ? new Date(body.due)
          : null,

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

    return NextResponse.json(event);
  } catch (error) {
    console.error("Failed to create task:", error);

    return NextResponse.json(
      {
        error: "Failed to create task",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}