// app/api/events/[id]/complete/route.ts

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { TaskStatus } from "@/app/generated/prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const updated = await prisma.task.update({
    where: { id },
    data: {
      status:
        task.status === "COMPLETE"
          ? "PENDING"
          : "COMPLETE",
    },
  });

  return NextResponse.json(updated);
}