// lib/fetchEmails.js

import { prisma } from "@/lib/prisma";
import { getGmailService } from "@/lib/gmail";

function extractBody(payload) {
  if (!payload) return "";

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }

  if (!payload.parts) return "";

  for (const part of payload.parts) {
    if (
      (part.mimeType === "text/plain" ||
        part.mimeType === "text/html") &&
      part.body?.data
    ) {
      return Buffer.from(part.body.data, "base64").toString("utf8");
    }

    if (part.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return "";
}


export async function fetchEmails(maxResults = 25) {
  const accounts = await prisma.gmailAccount.findMany();

  const allEmails = [];

  for (const account of accounts) {
    const gmail = await getGmailService(account);

    const { data } = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: "-in:spam -in:trash",
    });

    if (!data.messages) continue;

    const emails = await Promise.all(
      data.messages.map(async ({ id }) => {
        const { data: message } =
          await gmail.users.messages.get({
            userId: "me",
            id,
            format: "full",
          });

        const headers = message.payload.headers || [];

        // Define getHeader here
        const getHeader = (name) =>
          headers.find(
            (h) =>
              h.name.toLowerCase() === name.toLowerCase()
          )?.value || "";

        return {
          id: message.id,
          threadId: message.threadId,
          sender: getHeader("From"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          body: extractBody(message.payload),
          gmailAccount: account.email,
        };
      })
    );

    allEmails.push(...emails);
  }

  return allEmails;
}