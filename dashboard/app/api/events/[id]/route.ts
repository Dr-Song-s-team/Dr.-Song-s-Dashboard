import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }>}
) {

  const { id } = await params

  const body = await req.json();

  const nDate = new Date(body.dueDate);

  const formatOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false // Forces 24-hour format
  }

  const updated = await prisma.task.update({
    where: {
      id,
    },
    data: {
      title: body.title,
      description: body.description,
      dueDate: nDate,

      reminders: {
        deleteMany: {},

        create: (body.reminders ?? []).map((r: {remindAt: string }) => ({
          remindAt: new Date(r.remindAt),
        })),
      }
    },
    include: {
      patient: true,
      email: true,
      reminders: true
    }
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id }= await params

  await prisma.task.delete({
    where: {
      id,
    },
  });

  return NextResponse.json({ success: true });
}