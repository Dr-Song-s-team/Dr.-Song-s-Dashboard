import { NextResponse } from "next/server";

import { fetchEmails } from "@/lib/fetchEmails";          // your Gmail helper
import { analyzeEmails } from "@/app/(dashboard)/calendar/aiService";
import { createTasksFromAnalysis } from "@/app/(dashboard)/calendar/emailService";

export async function POST() {
  try {
    // Fetch the latest Gmail messages
    const emails = await fetchEmails(50);

    if (!emails.length) {
      return NextResponse.json({
        success: true,
        imported: 0,
      });
    }

    // Run AI analysis
    const analyses = await analyzeEmails(emails);

    // Convert recommended actions into calendar tasks
    await createTasksFromAnalysis(emails, analyses);

    return NextResponse.json({
      success: true,
      imported: emails.length,
    });

  } catch (err) {
    console.error("Import Gmail failed:", err);

    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}