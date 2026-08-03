"use client";

import { useState, useEffect, useCallback } from "react";
import ScheduleDashboard from "./ScheduleDashboard";

export default function CalendarPage() {

const [emails, setEmails]       = useState([]);
const [emailStatus, setEmailStatus]   = useState('loading');
const [emailError, setEmailError]     = useState(null);
const [scheduleStatus, setScheduleStatus]       = useState('loading');
const [scheduleEvents, setScheduleEvents] = useState([]);
const [polling, setPolling]     = useState(true);
const [dbEvents, setDbEvents] = useState([]);

const fetchEmails = useCallback(async () => {
  try {
    const res = await fetch('http://localhost:3001/api/emails');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (data.status === 'analyzing') { setEmailStatus('analyzing'); return false; }
    setEmails(data.emails || []);
    setEmailStatus('ready');
    return true;
  } catch (err) {
  setEmailError(
    err instanceof Error ? err.message : "Unknown error"
  );
  setEmailStatus('error');
}
}, []);

const fetchSchedule = useCallback(async () => {
  try {
    const res = await fetch('http://localhost:3001/api/schedule');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
    if (data.status === 'analyzing') { setScheduleStatus('analyzing'); return false; }
    setScheduleEvents(data.events || []);
    setScheduleStatus('ready');
    return true;
  } catch {
    setScheduleStatus('error');
    return true;
  }
}, []);

useEffect(() => {
  if (!polling) return undefined;
  let cancelled = false;
  const poll = async () => {
    const [inboxDone, schedDone] = await Promise.all([fetchEmails(), fetchSchedule()]);
    if (!cancelled && inboxDone && schedDone) setPolling(false);
  };
  poll();
  const interval = setInterval(poll, 2500);
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}, [fetchEmails, fetchSchedule, polling]);

const handleRefresh = async () => {
  setEmailStatus('analyzing');
  setScheduleStatus('analyzing');
  setEmails([]);
  // setScheduleEvents([]);
  try {
    const res = await fetch('http://localhost:3001/api/refresh', { method: 'POST' });
    console.log(res.status);
    if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
    setPolling(true);
  } catch (err) {
  setEmailError(
    err instanceof Error ? err.message : "Unknown error"
  );
  setEmailStatus('error');
}
};

const fetchDbEvents = useCallback(async () => {
  const res = await fetch("/api/events");

  if (!res.ok) return;

  const data = await res.json();

  const events = data.map(event => {

    const date = new Date(event.dueDate);

    return {
    id: event.id,
    emailId: event.emailId,
    title: event.title,
    patientName: event.patient ? `${event.patient.firstName} ${event.patient.lastName}` : null,
    date: date.toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    }),
    time: date.toLocaleTimeString("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,}),
  description: event.description,
  status: event.status,
  dueDate: event.dueDate,
  reminders: event.reminders,
};
  })

  setDbEvents(events);

}, []);

useEffect(() => {
fetchDbEvents();
}, []);

const formatEvent = (event) => {
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

const createEvent = async (event) => {

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

const updateEvent = async (id, updates) => {

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

const deleteEvent = async (id) => {

  await fetch(`/api/events/${id}`, {
      method: "DELETE",
  });

  setDbEvents(events =>
      events.filter(e => e.id !== id)
  );
};

    return (

        <ScheduleDashboard
          events={dbEvents}
          status = {scheduleStatus}
          onCreateEvent={createEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
          onRefresh={handleRefresh}
          onEventUpdated={setDbEvents}
        />
      );
}