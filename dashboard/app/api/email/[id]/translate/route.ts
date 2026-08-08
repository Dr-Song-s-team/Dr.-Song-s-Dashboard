import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { translateEmailContent } from "@/app/(dashboard)/calendar/aiService";

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const email = await prisma.email.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        body: true,
        aiSummary: true,
      },
    });

    if (!email) {
      return NextResponse.json(
        {
          error: "Email not found",
        },
        { status: 404 }
      );
    }

    const translated = await translateEmailContent(
      email.id,
      email.aiSummary ?? "",
      email.body
    );

    return NextResponse.json({
      success: true,
      summary: translated.summary,
      body: translated.body,
    });
  } catch (error) {
    console.error(
      "[email translate] Failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Translation failed",
      },
      { status: 500 }
    );
  }
}