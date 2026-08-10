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

  const allNewEmails = [];

  for (const account of accounts) {
    const gmail = await getGmailService(account);

    let pageToken = undefined;

    while (allNewEmails.length < maxResults) {
      const { data } = await gmail.users.messages.list({
        userId: "me",
        maxResults: 100,
        pageToken,
        q: "-in:spam -in:trash",
      });

      if (!data.messages || data.messages.length === 0) {
        break;
      }

      /*
       * Get all Gmail message IDs from this page.
       */
      const gmailIds = data.messages
        .map(({ id }) => id)
        .filter(Boolean);

      /*
       * Check which of these messages already exist
       * in our database.
       */
      const existingEmails = await prisma.email.findMany({
        where: {
          gmailMessageId: {
            in: gmailIds,
          },
        },
        select: {
          gmailMessageId: true,
        },
      });

      const existingIds = new Set(
        existingEmails.map(
          (email) => email.gmailMessageId
        )
      );

      /*
       * Only fetch full Gmail messages that aren't
       * already in the database.
       */
      const newMessageIds = gmailIds.filter(
        (id) => !existingIds.has(id)
      );

      console.log(
        `Gmail page: ${gmailIds.length} messages`
      );

      console.log(
        `Already in database: ${existingIds.size}`
      );

      console.log(
        `New messages: ${newMessageIds.length}`
      );

      /*
       * Fetch the full Gmail messages.
       */
      const emails = await Promise.all(
        newMessageIds.map(async (id) => {
          const { data: message } =
            await gmail.users.messages.get({
              userId: "me",
              id,
              format: "full",
            });

          const headers =
            message.payload?.headers || [];

          const getHeader = (name) =>
            headers.find(
              (h) =>
                h.name?.toLowerCase() ===
                name.toLowerCase()
            )?.value || "";

          return {
            id: message.id,
            threadId: message.threadId,
            sender: getHeader("From"),
            subject: getHeader("Subject"),
            date: getHeader("Date"),
            body: extractBody(message.payload),
            gmailAccount: account.email,
            gmailAccountId: account.id,
          };
        })
      );

      /*
       * Add the new emails to our result.
       */
      allNewEmails.push(...emails);

      /*
       * Stop once we have enough NEW emails.
       */
      if (allNewEmails.length >= maxResults) {
        break;
      }

      /*
       * Move to the next Gmail page.
       */
      pageToken = data.nextPageToken;

      if (!pageToken) {
        break;
      }
    }

    /*
     * Stop checking accounts once we have enough.
     */
    if (allNewEmails.length >= maxResults) {
      break;
    }
  }

  /*
   * Return exactly maxResults when possible.
   */
  return allNewEmails.slice(0, maxResults);
}