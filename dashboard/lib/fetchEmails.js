// lib/fetchEmails.js

import { getGmailService } from "./gmail";

function extractBody(payload) {
  if (!payload) return "";

  if (payload.body?.data) {
    return Buffer.from(
      payload.body.data.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
  }

  if (!payload.parts) return "";

  for (const part of payload.parts) {
    if (
      part.mimeType === "text/plain" &&
      part.body?.data
    ) {
      return Buffer.from(
        part.body.data.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf8");
    }

    const nested = extractBody(part);

    if (nested) return nested;
  }

  return "";
}

export async function fetchEmails(maxResults = 25) {
  const gmail = await getGmailService();

  const { data } = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: "-in:spam -in:trash",
  });

  if (!data.messages) return [];

  const emails = await Promise.all(
    data.messages.map(async ({ id }) => {
      const { data: message } = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });

      const headers = message.payload?.headers ?? [];

      const getHeader = (name) =>
        headers.find(
          (h) => h.name.toLowerCase() === name.toLowerCase()
        )?.value || "";

      const body = extractBody(message.payload);

      return {
        id: message.id,
        threadId: message.threadId,
        sender: getHeader("From"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        body,
      };
    })
  );

  return emails;
}