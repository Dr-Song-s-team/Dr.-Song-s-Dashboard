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

        <ScheduleDashboard
          events={dbEvents}
          status='done'
          onCreateEvent={createEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
          onEventUpdated={setDbEvents}
        />
      );
}