import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const events = await prisma.task.findMany({
    include: {
      patient: true,
      email: true,
      reminders: true,
    },
    orderBy: {
      dueDate: "asc",
    },
  });

  return NextResponse.json(events);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    /*
     * Find the existing Email.
     *
     * emailId coming from emailService is the Gmail message ID,
     * while Task.emailId must contain the Prisma Email.id.
     */
    let email = null;

    if (body.gmailMessageId) {
      email = await prisma.email.findUnique({
        where: {
          gmailMessageId: body.gmailMessageId,
        },
      });
    }

    /*
     * If the email doesn't exist yet, create it.
     */
    if (!email && body.email) {
      email = await prisma.email.create({
        data: {
          gmailMessageId: body.email.gmailMessageId,

          gmailThreadId:
            body.email.gmailThreadId ?? null,

          gmailAccountId:
            body.email.gmailAccountId ?? null,

          toInbox:
            body.email.toInbox ?? "GENERAL",

          fromName:
            body.email.fromName ??
            body.email.senderName ??
            "",

          fromEmail:
            body.email.fromEmail ??
            body.email.senderEmail ??
            "",

          subject:
            body.email.subject ?? "",

          body:
            body.email.body ?? "",

          receivedAt:
            body.email.receivedAt
              ? new Date(body.email.receivedAt)
              : new Date(),

          patientId:
            body.email.patientId ?? null,

          aiSummary:
            body.email.aiSummary ?? null,

          aiDraft:
            body.email.aiDraft ?? null,
        },
      });

      console.log(
        `Created Email ${email.id} for Gmail message ${email.gmailMessageId}`
      );
    }

    /*
     * If we still don't have an Email, return a useful error
     * instead of causing a Prisma foreign-key error.
     */
    if (!email) {
      return NextResponse.json(
        {
          error:
            "Could not find or create the source email.",
        },
        { status: 400 }
      );
    }

    /*
     * Prevent duplicate tasks for the same email/action.
     */
    const existing = await prisma.task.findFirst({
      where: {
        emailId: email.id,
        title: body.title,
      },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    /*
     * Create the task using the Prisma Email.id.
     */
    const event = await prisma.task.create({
      data: {
        title: body.title,

        description:
          body.description ?? null,

        dueDate:
          body.due
            ? new Date(body.due)
            : null,

        emailId: email.id,

        patientId:
          body.patientId ?? null,

        reminders: {
          create: (body.reminders ?? []).map(
            (r: { remindAt: string }) => ({
              remindAt: new Date(r.remindAt),
            })
          ),
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
    console.error("Failed creating task:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed creating task",
      },
      { status: 500 }
    );
  }
}