import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

const CALENDAR_ID = "primary";

export async function getGoogleCalendar() {
  const account = await prisma.gmailAccount.findFirst();

  if (!account) {
    throw new Error("No Google account connected.");
  }

  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  auth.setCredentials({
    refresh_token: account.refreshToken,
  });

  return google.calendar({
    version: "v3",
    auth,
  });
}

export function reminderMinutes(
  remindAt: Date,
  dueDate: Date
): number {
  return Math.round(
    (dueDate.getTime() - remindAt.getTime()) / 60000
  );
}

export function buildGoogleReminders(
  reminders: { remindAt: Date }[],
  dueDate: Date
) {
  const overrides = reminders
    .map((reminder) => ({
      method: "popup" as const,
      minutes: reminderMinutes(
        new Date(reminder.remindAt),
        dueDate
      ),
    }))
    .filter(
      (r) =>
        r.minutes >= 0 &&
        r.minutes <= 40320
    );

  return {
    useDefault: false,
    overrides,
  };
}

export async function createGoogleCalendarEvent({
  title,
  description,
  dueDate,
  reminders,
}: {
  title: string;
  description?: string | null;
  dueDate: Date;
  reminders: { remindAt: Date }[];
}) {
  const calendar = await getGoogleCalendar();

  const response = await calendar.events.insert({
    calendarId: "primary",

    requestBody: {
      summary: title,

      description:
        description ?? undefined,

      start: {
        dateTime: dueDate.toISOString(),
        timeZone: "America/Los_Angeles",
      },

      end: {
        dateTime: new Date(
          dueDate.getTime() + 15 * 60 * 1000
        ).toISOString(),
        timeZone: "America/Los_Angeles",
      },

      reminders: buildGoogleReminders(
        reminders,
        dueDate
      ),
    },
  });

  return response.data;
}