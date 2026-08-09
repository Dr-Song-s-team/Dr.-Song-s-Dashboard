// app/api/gmail/route.js

import { NextResponse } from "next/server";
import { fetchEmails } from "@/lib/fetchEmails";

export async function GET() {
  try {
    const emails = await fetchEmails(50);

    return NextResponse.json(emails);
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        error: "Unable to fetch Gmail messages",
      },
      {
        status: 500,
      }
    );
  }
}