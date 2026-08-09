import { NextResponse } from "next/server";
import { fetchEmails } from "@/lib/fetchEmails";
import { analyzeEmails } from "@/app/(dashboard)/calendar/aiService";
import {
  createTasksFromAnalysis,
  ensureEmailExists,
} from "@/app/(dashboard)/calendar/emailService";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    console.log("========== GMAIL IMPORT START ==========");

    const emails = await fetchEmails(12);

    console.log("Fetched:", emails.length, "emails");

    if (!emails.length) {
      return NextResponse.json({
        success: true,
        imported: 0,
        tasksCreated: 0,
      });
    }

    /*
     * --------------------------------------------------
     * STEP 1: SAVE EMAILS FIRST
     * --------------------------------------------------
     */

    const prismaEmails = [];

    for (const email of emails) {
      try {
        const prismaEmail = await ensureEmailExists(email);

        prismaEmails.push(prismaEmail);

        console.log(
          `Saved email: ${email.id} -> Prisma ${prismaEmail.id}`
        );
      } catch (error) {
        console.error(
          `Failed saving email ${email.id}:`,
          error
        );
      }
    }

    console.log(
      `Saved ${prismaEmails.length}/${emails.length} emails`
    );

    /*
     * --------------------------------------------------
     * STEP 2: RUN AI ANALYSIS
     * --------------------------------------------------
     */

    let analyses;

    try {
      console.log("Starting AI analysis...");

      analyses = await analyzeEmails(emails);

      console.log(
        "AI analysis finished:",
        analyses?.length,
        "results"
      );
    } catch (aiError) {
      console.error("AI analysis FAILED:", aiError);

      /*
       * IMPORTANT:
       * Emails are already in Prisma, so don't lose them
       * just because AI failed.
       */

      return NextResponse.json(
        {
          success: false,
          error: "AI analysis failed",
          details:
            aiError instanceof Error
              ? aiError.message
              : String(aiError),
          imported: prismaEmails.length,
          tasksCreated: 0,
        },
        { status: 500 }
      );
    }

    if (!analyses || analyses.length === 0) {
      console.log(
        "No analyses returned. Skipping task creation."
      );

      return NextResponse.json({
        success: true,
        imported: prismaEmails.length,
        tasksCreated: 0,
      });
    }

    /*
     * --------------------------------------------------
     * STEP 3: SAVE AI RESULTS TO EMAIL
     * --------------------------------------------------
     */

    for (let i = 0; i < analyses.length; i++) {
      const email = emails[i];
      const analysis = analyses[i];

      if (!email || !analysis) {
        continue;
      }

      const prismaEmail = prismaEmails.find(
        (saved) => saved.gmailMessageId === email.id
      );

      if (!prismaEmail) {
        console.warn(
          `Could not find Prisma email for Gmail ID ${email.id}`
        );
        continue;
      }

      const aiSummary = [
        analysis.summaryTitle,
        ...(analysis.summaryDetails || []),
      ]
        .filter(Boolean)
        .join("\n");

      await prisma.email.update({
        where: {
          id: prismaEmail.id,
        },
        data: {
          aiSummary,
          aiDraft: analysis.draftResponse,
        },
      });

      console.log(
        `Saved AI analysis -> Email ${prismaEmail.id}`
      );
    }

    /*
     * --------------------------------------------------
     * STEP 4: CREATE TASKS
     * --------------------------------------------------
     */

    console.log("========================================");
    console.log("CALLING createTasksFromAnalysis");
    console.log("Emails:", emails.length);
    console.log("Analyses:", analyses.length);
    console.log("========================================");

    let tasksCreated = 0;

    try {
      tasksCreated = await createTasksFromAnalysis(
        emails,
        analyses
      );

      console.log(
        "createTasksFromAnalysis finished:",
        tasksCreated
      );
    } catch (taskError) {
      console.error(
        "TASK CREATION FAILED:",
        taskError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Task creation failed",
          details:
            taskError instanceof Error
              ? taskError.message
              : String(taskError),
          imported: prismaEmails.length,
          tasksCreated: 0,
        },
        { status: 500 }
      );
    }

    console.log(
      "========== GMAIL IMPORT COMPLETE =========="
    );

    return NextResponse.json({
      success: true,
      imported: prismaEmails.length,
      analyzed: analyses.length,
      tasksCreated,
    });

  } catch (err) {
    console.error(
      "Import Gmail failed:",
      err
    );

    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : String(err),
      },
      { status: 500 }
    );
  }
}