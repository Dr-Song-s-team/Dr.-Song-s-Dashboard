import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const updated = await prisma.task.update({
    where: {
      id,
    },
    data: {
      status: "ARCHIVED",
    },
  });

  return NextResponse.json(updated);
}