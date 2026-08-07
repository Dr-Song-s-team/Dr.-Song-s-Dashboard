import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const supportedStatuses = ["READ", "NEEDS_ACTION"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;

  if (!supportedStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Status must be READ or NEEDS_ACTION." },
      { status: 400 },
    );
  }

  try {
    const email = await prisma.email.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });

    return NextResponse.json(email);
  } catch {
    return NextResponse.json({ error: "Email not found." }, { status: 404 });
  }
}
