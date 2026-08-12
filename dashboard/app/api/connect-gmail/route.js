// import { google } from "googleapis";
// import { NextResponse } from "next/server";

// export async function GET() {
//   const oauth2Client = new google.auth.OAuth2(
//     process.env.GMAIL_CLIENT_ID,
//     process.env.GMAIL_CLIENT_SECRET,
//     process.env.GMAIL_REDIRECT_URI
//   );

//   const url = oauth2Client.generateAuthUrl({
//     access_type: "offline",
//     prompt: "consent",
//     scope: [
//       "https://www.googleapis.com/auth/gmail.readonly",
//       "https://www.googleapis.com/auth/calendar.events",
//     ],
//   });

//   return NextResponse.redirect(url);
// }

import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function GET() {
  console.log(
    "GMAIL_REDIRECT_URI:",
    process.env.GMAIL_REDIRECT_URI
  );

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });

  console.log("GOOGLE AUTH URL:", url);

  return NextResponse.redirect(url);
}