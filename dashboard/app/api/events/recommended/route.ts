import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        extractionStatus: "PENDING_REVIEW",
      },
      include: {
        patient: true,
        email: true,
        reminders: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const recommendations = tasks.map((task) => ({
      id: task.id,
      emailId: task.emailId,
      title: task.title,
      summary: task.description ?? "",
      dueDate: task.dueDate?.toISOString() ?? null,

      recommendedActions: task.description
        ? [task.description]
        : [],

      patientName: task.patient
        ? `${task.patient.firstName} ${task.patient.lastName}`
        : null,

      email: task.email
        ? {
            id: task.email.id,
            gmailMessageId: task.email.gmailMessageId,
            gmailThreadId: task.email.gmailThreadId,
            fromName: task.email.fromName,
            fromEmail: task.email.fromEmail,
            subject: task.email.subject,
            body: task.email.body,
            receivedAt: task.email.receivedAt.toISOString(),
          }
        : null,
    }));

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error(
      "Failed to fetch recommended actions:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to fetch recommended actions",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}