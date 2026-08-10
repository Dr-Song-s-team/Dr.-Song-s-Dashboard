"use client";

import { useState, useEffect, useCallback } from "react";
import ScheduleDashboard from "./ScheduleDashboard";

interface CalendarEvent {
  id: string;
  emailId?: string;

  title: string;
  patientName?: string | null;
  date: string;
  time?: string;
  description?: string;
  status: "PENDING" | "COMPLETE" | "ARCHIVED";
  dueDate: string;

  googleEventId?: string | null;

  email?: {
    id: string;
    gmailMessageId: string | null;
    gmailThreadId?: string | null;
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    receivedAt: string;
  } | null;

  reminders?: {
    id: number;
    remindAt: string;
  }[];
}

interface ApiEvent {
  id: string;
  emailId?: string;
  title: string;
  dueDate: string;
  description?: string;
  status: "PENDING" | "COMPLETE" | "ARCHIVED";

  googleEventId?: string | null;

  patient?: {
    firstName: string;
    lastName: string;
  };

  email?: {
    id: string;
    gmailMessageId: string | null;
    gmailThreadId?: string | null;
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    receivedAt: string;
  } | null;

  reminders?: {
    id: number;
    remindAt: string;
  }[];
}

export default function CalendarPage() {

const [dbEvents, setDbEvents] = useState<CalendarEvent[]>([]);
const [isSyncing, setIsSyncing] = useState(false);
const [syncResult, setSyncResult] = useState<string | null>(null);

useEffect(() => {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported");
    return;
  }

  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      console.log("Service worker registered:", registration);
    })
    .catch((error) => {
      console.error("Service worker registration failed:", error);
    });
}, []);

const getDbEvents = useCallback(async (): Promise<CalendarEvent[]> => {
  const res = await fetch("/api/events");

  if (!res.ok) {
    throw new Error("Failed to fetch calendar events");
  }

  const data: ApiEvent[] = await res.json();

  return data
    .filter((event) => event.dueDate)
    .map((event): CalendarEvent => {
      const date = new Date(event.dueDate);

      return {
        id: event.id,
        emailId: event.emailId,
        title: event.title,

        patientName: event.patient
          ? `${event.patient.firstName} ${event.patient.lastName}`
          : null,

        date: date.toLocaleDateString("en-CA", {
          timeZone: "America/Los_Angeles",
        }),

        time: date.toLocaleTimeString("en-US", {
          timeZone: "America/Los_Angeles",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),

        description: event.description,
        status: event.status,
        dueDate: event.dueDate,
        googleEventId: event.googleEventId,
        email: event.email,
        reminders: event.reminders,
      };
    });
}, []);

useEffect(() => {
  let cancelled = false;

  const loadEvents = async () => {
    try {
      const events = await getDbEvents();

      if (!cancelled) {
        setDbEvents(events);
      }
    } catch (error) {
      if (!cancelled) {
        console.error("Failed to fetch calendar events:", error);
      }
    }
  };

  void loadEvents();

  return () => {
    cancelled = true;
  };
}, [getDbEvents]);

const formatEvent = (event: CalendarEvent): CalendarEvent => {
  const date = new Date(event.dueDate);

  return {
    ...event,
    date: date.toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    }),
    time: date.toLocaleTimeString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
};

const createEvent = async (event: Partial<CalendarEvent>) => {

  const res = await fetch("/api/events", {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
  });

  const created = await res.json();

  setDbEvents(prev => [...prev, formatEvent(created)]);
};

const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {

  const res = await fetch(`/api/events/${id}`, {
      method: "PUT",
      headers: {
          "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
  });

  const updated = await res.json();

  console.log("Updated event from API:", updated);

  setDbEvents((prev) => 
    prev.map((event) =>
      event.id === id ? formatEvent(updated) : event
      )
  );
};

const deleteEvent = async (id: string) => {

  await fetch(`/api/events/${id}`, {
      method: "DELETE",
  });

  setDbEvents((events: CalendarEvent[]) =>
      events.filter(e => e.id !== id)
  );
};

const handleSyncFromEmails = async () => {
  setIsSyncing(true);
  setSyncResult(null);

  try {
    const res = await fetch("/api/events/sync-from-emails", {
      method: "POST",
    });

    if (!res.ok) {
      throw new Error("Sync failed");
    }

    const result = await res.json();

    // Refresh calendar
    const events = await getDbEvents();
    setDbEvents(events);

    // Show result
    setSyncResult(
      `Sync complete: ${result.created} tasks created, ${result.skipped} duplicates skipped`
    );

    // Auto-dismiss after 5 seconds
    setTimeout(() => setSyncResult(null), 5000);
  } catch (error) {
    console.error("Sync error:", error);
    setSyncResult("Sync failed. Please try again.");
    setTimeout(() => setSyncResult(null), 5000);
  } finally {
    setIsSyncing(false);
  }
};

console.log(
  "Calendar events:",
  dbEvents.map((event) => ({
    id: event.id,
    title: event.title,
    dueDate: event.dueDate,
  }))
);

const ids = dbEvents.map((event) => event.id);

console.log(
  "Duplicate IDs:",
  ids.filter((id, index) => ids.indexOf(id) !== index)
);

    return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleSyncFromEmails}
                disabled={isSyncing}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSyncing ? "Syncing..." : "Sync Tasks from Emails"}
              </button>

              {syncResult && (
                <div
                  className={`px-4 py-2 rounded-md text-sm ${
                    syncResult.includes("failed")
                      ? "bg-red-100 text-red-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {syncResult}
                </div>
              )}
            </div>
          </div>

          <ScheduleDashboard
            events={dbEvents}
            status='done'
            onCreateEvent={createEvent}
            onUpdateEvent={updateEvent}
            onDeleteEvent={deleteEvent}
            onEventUpdated={setDbEvents}
          />
        </div>
      );
}