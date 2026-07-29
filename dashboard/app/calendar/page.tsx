"use client";

import { useState, useEffect, useCallback } from "react";
import ScheduleDashboard from "./ScheduleDashboard";

export default function CalendarPage() {

const [emails, setEmails]       = useState([]);
const [emailStatus, setEmailStatus]   = useState('loading');
const [emailError, setEmailError]     = useState(null);
const [scheduleEvents, setScheduleEvents]       = useState([]);
const [scheduleStatus, setScheduleStatus]       = useState('loading');
const [polling, setPolling]     = useState(true);

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
    setEmailError(err.message);
    setEmailStatus('error');
    return true;
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
  setScheduleEvents([]);
  try {
    const res = await fetch('http://localhost:3001/api/refresh', { method: 'POST' });
    if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
    setPolling(true);
  } catch (err) {
    setEmailError(err.message);
    setEmailStatus('error');
    setScheduleStatus('error');
  }
};

  
    return (

        <ScheduleDashboard
          events={scheduleEvents}
          status = {scheduleStatus}
        />
      );
}