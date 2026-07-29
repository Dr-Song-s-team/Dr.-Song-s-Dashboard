import { useState } from 'react';
import { EVENT_TYPE_LABELS } from '../utils/labels.js';
import './ScheduleDashboard.css';
import Holidays from "date-holidays";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const hd = new Holidays("US")

const UNSCHEDULED = 'unscheduled';

function eventClass(event) {
  if (event.category === 'insurance') {
    return event.urgency === 'high' ? 'ev--ins-high' : 'ev--ins-med';
  }
  if (event.type === 'reschedule' || event.type === 'cancellation') return 'ev--resched';
  if (event.urgency === 'high') return 'ev--client-high';
  return 'ev--client';
}

export default function ScheduleDashboard({ events, status }) {
  const CALENDAR_DAYS = []
  const [selected, setSelected] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(6); // July (0 = January)
  const [currentYear, setCurrentYear] = useState(2026);

  if (status === 'loading' || status === 'analyzing') {
    return (
      <div className="sched-loading">
        <div className="spinner" />
        <p>Extracting schedule from emails…</p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="sched-loading">
        <p>No scheduling data available.</p>
      </div>
    );
  }

  function previousMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  }
  
  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  }

  const holidays = hd.getHolidays(currentYear);

  const holidayMap = {};

  holidays.forEach(h => {
    holidayMap[h.date.slice(0, 10)] = h.name;
  });

const firstDay = new Date(currentYear, currentMonth, 1);
const lastDay = new Date(currentYear, currentMonth + 1, 0);

for (let d = 1; d <= lastDay.getDate(); d++) {
  const date = new Date(currentYear, currentMonth, d);

  CALENDAR_DAYS.push({
    date: date.toISOString().split("T")[0],
    day: String(d),
  });

}

  const filtered = categoryFilter === 'all'
    ? events
    : events.filter(e => e.category === categoryFilter);

  // Group events by date
  const byDate = {};
  const unscheduled = [];
  filtered.forEach(ev => {
    if (ev.date) {
      if (!byDate[ev.date]) byDate[ev.date] = [];
      byDate[ev.date].push(ev);
    } else {
      unscheduled.push(ev);
    }
  });

  // Count urgent items
  const urgentCount   = events.filter(e => e.urgency === 'high').length;
  const deadlineCount = events.filter(e => e.type === 'deadline').length;
  const apptCount     = events.filter(e => e.type === 'appointment' || e.type === 'reschedule').length;

  const selectedEvent = selected ? events.find(e => e.emailId === selected) : null;

  return (
    <div className="sched-root">
      {/* Dashboard header */}
      <div className="sched-header">
        <div className="sched-title-area">
        <div className="sched-title-nav">
  <button
    className="month-arrow"
    onClick={previousMonth}
  >
    ←
  </button>

  <h2 className="sched-title">
    Schedule — {MONTHS[currentMonth]} {currentYear}
  </h2>

  <button
    className="month-arrow"
    onClick={nextMonth}
  >
    →
  </button>
</div>
          <p className="sched-subtitle">Extracted from {events.length} scheduling emails</p>
        </div>
        <div className="sched-stats">
          <StatBubble value={urgentCount}   label="Urgent" color="high" />
          <StatBubble value={deadlineCount} label="Deadlines" color="ins" />
          <StatBubble value={apptCount}     label="Appointments" color="appt" />
        </div>
        <div className="sched-cat-filter">
          {['all', 'client', 'insurance'].map(c => (
            <button
              key={c}
              className={`scat-btn ${categoryFilter === c ? 'scat-btn--active' : ''}`}
              onClick={() => setCategoryFilter(c)}
            >
              {c === 'all' ? 'All' : c === 'client' ? 'Patients' : 'Insurance'}
            </button>
          ))}
        </div>
      </div>

      <div className="sched-body">
        {/* Calendar grid */}
        <div className="calendar-wrap">
          <div className="calendar-grid">
            {CALENDAR_DAYS.map(day => {
              const weekday = new Date(
                currentYear,
                currentMonth,
                Number(day.day)).toLocaleDateString("en-US", {
                weekday: "short",
              });
              const holidayName = holidayMap[day.date]
              const dayEvents = byDate[day.date] || [];
              const isWeekend = weekday === 'Sat' || weekday === 'Sun';
              const hasHigh   = dayEvents.some(e => e.urgency === 'high');
              return (
                <div
                  key={day.date}
                  className={`cal-day ${isWeekend ? 'cal-day--weekend' : ''} ${hasHigh ? 'cal-day--has-high' : ''}`}
                >
                  <div className="cal-day-header">
                    <span className="cal-weekday">{weekday}</span>
                    <span className={`cal-date ${hasHigh ? 'cal-date--high' : ''}`}>{day.day}</span>
                    {dayEvents.length > 0 && (
                      <span className="cal-count">{dayEvents.length}</span>
                    )}
                    {holidayName && (
    <div className="holiday-label">
      🎉 {holidayName}
    </div>
  )}
                  </div>
                  <div className="cal-events">
                    {dayEvents.length === 0 ? (
                      <div className="cal-empty-day" />
                    ) : (
                      dayEvents.map(ev => (
                        <button
                          key={ev.emailId}
                          className={`cal-event ${eventClass(ev)} ${selected === ev.emailId ? 'cal-event--selected' : ''}`}
                          onClick={() => setSelected(selected === ev.emailId ? null : ev.emailId)}
                          title={ev.subject}
                        >
                          <div className="cal-event-type">
                            {EVENT_TYPE_LABELS[ev.type] || ev.type}
                            {ev.time && <span className="cal-event-time"> {formatTime(ev.time)}</span>}
                          </div>
                          <div className="cal-event-patient">{ev.patientName}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unscheduled */}
          {unscheduled.length > 0 && (
            <div className="unscheduled-section">
              <div className="unscheduled-header">
                <span>No specific date</span>
                <span>{unscheduled.length}</span>
              </div>
              <div className="unscheduled-list">
                {unscheduled.map(ev => (
                  <button
                    key={ev.emailId}
                    className={`unsched-item ${eventClass(ev)} ${selected === ev.emailId ? 'cal-event--selected' : ''}`}
                    onClick={() => setSelected(selected === ev.emailId ? null : ev.emailId)}
                  >
                    <span className="unsched-type">{EVENT_TYPE_LABELS[ev.type]}</span>
                    <span className="unsched-patient">{ev.patientName}</span>
                    <span className="unsched-title">{ev.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="sched-detail">
          {selectedEvent ? (
            <EventDetail event={selectedEvent} />
          ) : (
            <div className="sched-detail-empty">
              <p className="detail-empty-icon">◷</p>
              <p>Select an event to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBubble({ value, label, color }) {
  return (
    <div className={`stat-bubble stat-bubble--${color}`}>
      <span className="stat-bubble-val">{value}</span>
      <span className="stat-bubble-label">{label}</span>
    </div>
  );
}

function EventDetail({ event }) {
  return (
    <div className="event-detail">
      <div className={`event-detail-stripe ${eventClass(event)}`} />
      <div className="event-detail-content">
        <div className="event-detail-meta">
          <span className={`event-type-badge et--${event.type}`}>
            {EVENT_TYPE_LABELS[event.type]}
          </span>
          <span className={`urgency-dot urgency-dot--${event.urgency}`} />
          <span className="event-urgency-label">{event.urgency} urgency</span>
        </div>
        <h3 className="event-detail-title">{event.title}</h3>
        {event.date && (
          <p className="event-detail-date">
            {formatDate(`${event.date}`)}
            {event.time && ` at ${formatTime(event.time)}`}
          </p>
        )}
        <p className="event-detail-patient">
          <span className="detail-field">Patient / Entity</span>
          {event.patientName}
        </p>
        {event.subject && (
          <div className="event-detail-section">
            <span className="detail-field">Email Subject</span>
            <p className="event-detail-subject">{event.subject}</p>
          </div>
        )}
        {event.body && (
          <div className="event-detail-section event-detail-body-wrap">
            <span className="detail-field">Email Body</span>
            <div className="event-detail-body">
              {event.body.split('\n').map((line, i) =>
                line.trim() === '' ? <br key={i} /> : <p key={i}>{line}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso) {
  const [, , dd] = iso.split('-');
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = parseInt(iso.split('-')[1], 10);
  const d = parseInt(dd, 10);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const wd = weekdays[new Date(iso).getDay()];
  return `${wd}, ${months[m]} ${d}, 2026`;
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}