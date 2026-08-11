import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be JSON." },
        { status: 400 }
      );
    }

    const { analysisUsefulness, koreanTranslationAccuracy } = body as Record<string, unknown>;

    if (!isValidScore(analysisUsefulness)) {
      return NextResponse.json(
        { error: "analysisUsefulness must be an integer from 1 to 5." },
        { status: 400 }
      );
    }

    if (!isValidScore(koreanTranslationAccuracy)) {
      return NextResponse.json(
        { error: "koreanTranslationAccuracy must be an integer from 1 to 5." },
        { status: 400 }
      );
    }

    const email = await prisma.email.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found." }, { status: 404 });
    }

    const metric = await prisma.emailMetric.create({
      data: {
        emailId: id,
        analysisUsefulness,
        koreanTranslationAccuracy,
      },
    });

    return NextResponse.json({ success: true, id: metric.id }, { status: 201 });
  } catch (error) {
    console.error("[email metrics] POST failed:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
