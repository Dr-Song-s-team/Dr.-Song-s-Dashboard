import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code." },
        { status: 400 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          error:
            "Google did not return a refresh token. Revoke the app and reconnect with access_type=offline & prompt=consent.",
        },
        { status: 400 }
      );
    }

    oauth2Client.setCredentials(tokens);

    // Get Gmail profile
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const profile = await gmail.users.getProfile({
      userId: "me",
    });

    const email = profile.data.emailAddress;

    // Save or update account
    await prisma.gmailAccount.upsert({
      where: {
        emailAddress: email,
      },
      update: {
        refreshToken: tokens.refresh_token,
      },
      create: {
        emailAddress: email,
        refreshToken: tokens.refresh_token,
      },
    });

    console.log("Connected Gmail:", email);

    return NextResponse.redirect(
      new URL("/calendar", req.url)
    );

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}