import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const events = await prisma.task.findMany({
    include: {
patient: true,
email: true
    },
      orderBy: {
        dueDate: "asc",
      },
    });
  
    return NextResponse.json(events);
  }

  export async function POST(req: Request) {
    const body = await req.json();
  
    const event = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description,
        dueDate: new Date(body.due),
      },
    });
  
    return NextResponse.json(event);
  }