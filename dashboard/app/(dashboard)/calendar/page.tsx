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

interface RecommendedAction {
  id: string;
  emailId: string | null;
  title: string;
  summary: string;
  dueDate: string | null;
  recommendedActions: string[];
  patientName?: string | null;
  extractionStatus?: "ACCEPTED" | "EDITED" | "REJECTED";

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
}

interface EventInput {
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  due?: Date;
  dueDate?: Date;
  reminders?: {
    remindAt: string;
  }[];
}

export default function CalendarPage() {

const [dbEvents, setDbEvents] = useState<CalendarEvent[]>([]);
const [recommendedActions, setRecommendedActions] = useState<
  RecommendedAction[]
>([]);

const [sourceEmail, setSourceEmail] = useState<
  RecommendedAction["email"]
>(null);
const [editingAction, setEditingAction] =
  useState<RecommendedAction | null>(null);

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

const getRecommendedActions = useCallback(
  async (): Promise<RecommendedAction[]> => {
    const res = await fetch("/api/events/recommended");

    if (!res.ok) {
      throw new Error("Failed to fetch recommended actions");
    }

    return res.json();
  },
  []
);

useEffect(() => {
  let cancelled = false;

  const loadCalendarData = async () => {
    try {
      const [events, recommendations] = await Promise.all([
        getDbEvents(),
        getRecommendedActions(),
      ]);

      if (!cancelled) {
        setDbEvents(events);
        setRecommendedActions(recommendations);
      }
    } catch (error) {
      if (!cancelled) {
        console.error(
          "Failed to fetch calendar data:",
          error
        );
      }
    }
  };

  void loadCalendarData();

  return () => {
    cancelled = true;
  };
}, [getDbEvents, getRecommendedActions]);

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

const createEvent = async (event: EventInput) => {

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

const updateEvent = async (id: string, updates: EventInput) => {

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
    const res = await fetch(
      "/api/events/sync-from-emails",
      {
        method: "POST",
      }
    );

    const result = await res.json();

    if (!res.ok) {
      throw new Error(
        result.error || "Sync failed"
      );
    }

    const recommendations =
      await getRecommendedActions();

    setRecommendedActions(
      recommendations
    );

    setSyncResult(
      `Sync complete: ${result.created} tasks need review, ${result.skipped} duplicates skipped`
    );

    setTimeout(
      () => setSyncResult(null),
      5000
    );
  } catch (error) {
    console.error(
      "Sync error:",
      error
    );

    setSyncResult(
      `Sync failed. Please try again. ${error}`
    );

    setTimeout(
      () => setSyncResult(null),
      5000
    );
  } finally {
    setIsSyncing(false);
  }
};

const acceptRecommendedAction = async (
  action: RecommendedAction
) => {
  try {
    const res = await fetch(
      `/api/events/${action.id}/accept`,
      {
        method: "POST",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || "Failed to accept task"
      );
    }

    const acceptedEvent = formatEvent(data);

    setDbEvents((prev) => [
      ...prev,
      acceptedEvent,
    ]);

    setRecommendedActions((prev) =>
      prev.filter((item) => item.id !== action.id)
    );
  } catch (error) {
    console.error(
      "Failed to accept recommended action:",
      error
    );
  }
};

const rejectRecommendedAction = async (
  action: RecommendedAction
) => {
  try {
    const res = await fetch(
      `/api/events/${action.id}/reject`,
      {
        method: "POST",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || "Failed to reject task"
      );
    }

    setRecommendedActions((prev) =>
      prev.filter((item) => item.id !== action.id)
    );
  } catch (error) {
    console.error(
      "Failed to reject recommended action:",
      error
    );
  }
};

const viewSourceEmail = (
  action: RecommendedAction
) => {
  if (!action.email) {
    console.warn(
      "No source email available for this recommendation"
    );
    return;
  }

  setSourceEmail(action.email);
};

const editRecommendedAction = async (
  action: RecommendedAction,
  updates: {
    title: string;
    summary: string;
    dueDate: string | null;
    patientName: string | null;
  }
): Promise<void> => {
  try {
    console.log("Editing recommended task:", {
      action,
      updates,
    });

    const payload = {
      title: updates.title,
      summary: updates.summary,
      dueDate: updates.dueDate,
      patientName: updates.patientName,
    };

    console.log(
      "Sending edit payload:",
      JSON.stringify(payload)
    );

    const res = await fetch(
      `/api/events/${action.id}/edit`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const text = await res.text();

    console.log(
      "Edit API response:",
      res.status,
      text
    );

    let data: {
      error?: string;
      details?: string;
      event?: CalendarEvent;
    } = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error(
          "Failed to parse edit response:",
          parseError
        );

        throw new Error(
          `Server returned invalid JSON (${res.status})`
        );
      }
    }

    if (!res.ok) {
      throw new Error(
        data.error ||
          data.details ||
          `Failed to edit task (${res.status})`
      );
    }

    // Remove the edited recommendation from Needs Review.
    setRecommendedActions((prev) =>
      prev.filter((item) => item.id !== action.id)
    );

    // If the API returns the updated calendar event,
    // add/update it in the calendar.
    if (data.event) {
      const updatedEvent = formatEvent(data.event);

      setDbEvents((prev) => {
        const exists = prev.some(
          (event) => event.id === updatedEvent.id
        );

        if (exists) {
          return prev.map((event) =>
            event.id === updatedEvent.id
              ? updatedEvent
              : event
          );
        }

        return [...prev, updatedEvent];
      });
    }
  } catch (error) {
    console.error(
      "Failed to edit recommended task:",
      error
    );

    throw error;
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
  status={'done'}
  onCreateEvent={createEvent}
  onUpdateEvent={updateEvent}
  onDeleteEvent={deleteEvent}
  onEventUpdated={setDbEvents}

  recommendedActions={recommendedActions}

  onAcceptRecommendedAction={acceptRecommendedAction}
  onRejectRecommendedAction={rejectRecommendedAction}
  onEditRecommendedAction={editRecommendedAction}
  onViewSourceEmail={viewSourceEmail}
/>

{editingAction && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
      <div className="flex items-center justify-between border-b p-5">
        <div>
          <h2 className="text-lg font-semibold">
            Edit Recommended Task
          </h2>
          <p className="text-sm text-gray-500">
            Modify the task before accepting it.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditingAction(null)}
          className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Title
          </label>

          <input
            type="text"
            value={editingAction.title}
            onChange={(e) =>
              setEditingAction((current) =>
                current
                  ? {
                      ...current,
                      title: e.target.value,
                    }
                  : null
              )
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Patient
          </label>

          <input
            type="text"
            value={editingAction.patientName ?? ""}
            onChange={(e) =>
              setEditingAction((current) =>
                current
                  ? {
                      ...current,
                      patientName: e.target.value,
                    }
                  : null
              )
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Due Date
          </label>

          <input
            type="datetime-local"
            value={
              editingAction.dueDate
                ? new Date(editingAction.dueDate)
                    .toISOString()
                    .slice(0, 16)
                : ""
            }
            onChange={(e) =>
              setEditingAction((current) =>
                current
                  ? {
                      ...current,
                      dueDate: e.target.value
                        ? new Date(
                            e.target.value
                          ).toISOString()
                        : null,
                    }
                  : null
              )
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Summary
          </label>

          <textarea
            value={editingAction.summary ?? ""}
            onChange={(e) =>
              setEditingAction((current) =>
                current
                  ? {
                      ...current,
                      summary: e.target.value,
                    }
                  : null
              )
            }
            rows={4}
            className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t p-4">
        <button
          type="button"
          onClick={() => setEditingAction(null)}
          className="rounded-md bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => {
            if (!editingAction) return;

            setRecommendedActions((prev) =>
              prev.map((action) =>
                action.id === editingAction.id
                  ? editingAction
                  : action
              )
            );

            setEditingAction(null);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
)}

{sourceEmail && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        setSourceEmail(null);
      }
    }}
  >
    <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-lg bg-white shadow-xl">
      <div className="flex items-start justify-between border-b p-5">
        <div>
          <h2 className="text-lg font-semibold">
            {sourceEmail.subject}
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            From: {sourceEmail.fromName} (
            {sourceEmail.fromEmail})
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {new Date(
              sourceEmail.receivedAt
            ).toLocaleString()}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSourceEmail(null)}
          className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[65vh] overflow-y-auto p-5">
        <div className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
          {sourceEmail.body}
        </div>
      </div>

      <div className="flex justify-end border-t p-4">
        <button
          type="button"
          onClick={() => setSourceEmail(null)}
          className="rounded-md bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}
        </div>
      );
}