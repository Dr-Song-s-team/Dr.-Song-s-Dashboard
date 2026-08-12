import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
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
        extractionStatus: "REJECTED",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(
      "Failed to reject recommended task:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to reject recommended task",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}