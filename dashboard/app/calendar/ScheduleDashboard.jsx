import { useState, useEffect } from 'react';
import { EVENT_TYPE_LABELS } from '../utils/labels.js';
import './ScheduleDashboard.css';
import Holidays from "date-holidays";
import ScheduleList from "./ScheduleList"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const hd = new Holidays("US")

const UNSCHEDULED = 'unscheduled';

export default function ScheduleDashboard({ events, status, onCreateEvent, onUpdateEvent, onDeleteEvent, onRefresh }) {
  
  const CALENDAR_DAYS = []
  const [selected, setSelected] = useState(null);
  // const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(6); // July (0 = January)
  const [currentYear, setCurrentYear] = useState(2026);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    due: ""
  });
  const [selectedDate, setSelectedDate] = useState(null);

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

  // const filtered = categoryFilter === 'all'
  //   ? events
  //   : events.filter(e => e.category === categoryFilter);



  // Group events by date
  const byDate = {};
  const unscheduled = [];
  events.forEach(ev => {
    console.log(ev)
    if (ev.date) {
      if (!byDate[ev.date]) byDate[ev.date] = [];
      byDate[ev.date].push(ev);
    } else {
      unscheduled.push(ev);
    }
  });

  //console.log(events)

  // Count urgent items
  // const urgentCount   = events.filter(e => e.urgency === 'high').length;
  //const deadlineCount = events.filter(e => e.type === 'deadline').length;
  //const apptCount     = events.filter(e => e.type === 'appointment' || e.type === 'reschedule').length;

  const selectedEvent = selected ? events.find(e => e.id === selected) : null;

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
          {/* <StatBubble value={urgentCount}   label="Urgent" color="high" /> */}
          {/* <StatBubble value={deadlineCount} label="Deadlines" color="ins" />
          <StatBubble value={apptCount}     label="Appointments" color="appt" /> */}
        </div>
        <button onClick={onRefresh}
        className="cursor-pointer">
  Refresh
</button>
        <button
        onClick={() => setShowCreateModal(true)}
        className="cursor-pointer"
>
  + New Event
</button>

        {/* <div className="sched-cat-filter">
          {['all', 'client', 'insurance'].map(c => (
            <button
              key={c}
              className={`scat-btn ${categoryFilter === c ? 'scat-btn--active' : ''}`}
              onClick={() => setCategoryFilter(c)}
            >
              {c === 'all' ? 'All' : c === 'client' ? 'Patients' : 'Insurance'}
            </button>
          ))}
        </div> */}
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
              return (
                <div
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className="cursor-pointer"
                >
                  <div className="cal-day-header">
                  <span className="cal-daynum">{day.day}</span>
                    <span className="cal-weekday">{weekday}</span>
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
                          key={ev.id}
                          className={`cal-event ${selected === ev.id ? 'cal-event--selected' : ''}`}
                          onClick={() => setSelected(selected === ev.id ? null : ev.id)}
                          title={ev.subject}
                        >
                          <div className="cal-event-type">
                            
                            {ev.time && <span className="cal-event-time"> {formatTime(ev.time)}</span>}
                          </div>
                          <div className="cal-event-patient">{ev.patientName ? ev.patientName : ev.title}</div>
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
                    key={ev.id}
                    className={`unsched-item ${selected === ev.id ? 'cal-event--selected' : ''}`}
                    onClick={() => setSelected(selected === ev.id ? null : ev.id)}
                  >
                    
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
            <EventDetail event={selectedEvent}
            onUpdateEvent={onUpdateEvent}
            onDeleteEvent={onDeleteEvent} />
          ) : (
            <div className="sched-detail-empty">
              <p className="detail-empty-icon">◷</p>
              <p>Select an event to see details</p>
            </div>
          )}
        </div>
      </div>
      {showCreateModal && (
  <div className="modal-overlay">
    <div className="modal">

      <h2>Create Event</h2>

    <div className="form-group">
    <label htmlFor="title">Title</label>
      <input
        id="title"
        value={newEvent.title ?? ""}
        onChange={e =>
          setNewEvent({
            ...newEvent,
            title: e.target.value
          })
        }
      />
      </div>

    <div className="form-group">
    <label htmlFor="description">Description</label>
      <textarea
        id="description"
        value={newEvent.description ?? ""}
        onChange={e =>
          setNewEvent({
            ...newEvent,
            description: e.target.value
          })
        }
      />
      </div>

      <div className="form-group">
    <label htmlFor="date">Due Date</label>
      <input
        id="date"
        type="date"
        value={newEvent.date ?? ""}
        onChange={e =>
          setNewEvent({
            ...newEvent,
            date: e.target.value
          })
        }
      />
      </div>

      <div className="form-group">
      <label htmlFor="time">Due Time</label>
      <input
        id="time"
        type="time"
        value={newEvent.time ?? ""}
        onChange={e =>
          setNewEvent({
            ...newEvent,
            time: e.target.value
          })
        }
      />
      </div>

      

      <div className="modal-buttons">

        <button onClick={() => setShowCreateModal(false)}>
          Cancel
        </button>

        <button
          onClick={() => {

            const dueDateTime = new Date(
              `${newEvent.date}T${newEvent.time}`
            );

            onCreateEvent({
              title: newEvent.title,
              description: newEvent.description,
              due: dueDateTime,
            });

            setShowCreateModal(false);

            setNewEvent({
              title: "",
              description: "",
              date: "",
              time: "",
            });
          }}
        >
          Create
        </button>

      </div>

    </div>
  </div>
)}
{selectedDate && (
  <ScheduleList
  events={events}
  selectedDate={selectedDate}
  onClose={() => setSelectedDate(null)}
  onSelectEvent={(id) => setSelected(id)}
  selectedEventId={selected}
  />
)}
    </div>
  );
}

function toInputTime(t) {
  if (!t) return "";

  const ampmMatch = t.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (ampmMatch) {
    let [, h, m, period] = ampmMatch;
    h = parseInt(h, 10);
    period = period.toUpperCase();

    if (period === 'AM') {
      if (h === 12) h = 0;       // 12 AM -> 00
    } else {
      if (h !== 12) h += 12;     // PM hours except 12 PM -> +12
    }

    return `${String(h).padStart(2, '0')}:${m}`;
  }

  const plainMatch = t.match(/^(\d{1,2}):(\d{2})$/);
  if (plainMatch) {
    const [, h, m] = plainMatch;
    return `${h.padStart(2, '0')}:${m}`;
  }

  return t;
}

  function EditEventForm({ event, onUpdateEvent, onCancel }) {
    const [formData, setFormData] = useState({
      title: event.title ?? "",
      description: event.description ?? "",
      date: event.date ?? "",
      time: toInputTime(event.time),
  })

  console.log(event.time)

  useEffect(() => {
  setFormData({
    title: event.title ?? "",
    description: event.description ?? "",
    date: event.date ?? "",
    time: toInputTime(event.time),
  });
}, [event]);

function handleChange(e) {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();

    const dueDate = `${formData.date}T${formData.time}`

    onUpdateEvent(event.id, {
      ...event,
      ...formData,
      dueDate
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Title: </label>
        <input
          name="title"
          value={formData.title}
          onChange={handleChange}
        />
      </div>

      <div>
        <label>Due Date: </label>
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
        />
      </div>

      <div>
        <label>Due Time: </label>
        <input
          type="time"
          name="time"
          value={formData.time}
          onChange={handleChange}
        />
      </div>

      <div>
        <label>Description:</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
        />
      </div>

      <div className="flex gap-4 mt-4">

      <button type="submit">
        Save
      </button>

      <button type="button" onClick={onCancel}>
        Cancel
      </button>

      </div>
    </form>
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

function EventDetail({ event, onUpdateEvent, onDeleteEvent }) {
const [editing, setEditing] = useState(false);

  return (
    <div className="event-detail">
      
      <div className="event-detail-content">
        <div className="event-detail-meta">
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
        <>
        {!editing ? (
        <button
  onClick={() =>
    setEditing(true)
  }
  className="cursor-pointer"
>
  Edit
</button>
        ) : (
          <EditEventForm
        event={event}
        onUpdateEvent={onUpdateEvent}
        onCancel={() => setEditing(false)}
      />
        )}
</>
<button
  onClick={() => onDeleteEvent(event.id)}
  className="cursor-pointer"
>
  Delete
</button>
      </div>
    </div>
  );
}

function formatDate(iso) {
  const [y, m, dd] = iso.split('-').map(Number);
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const wd = weekdays[new Date(y, m-1, dd).getDay()];
  return `${wd}, ${months[m]} ${dd}, ${y}`;
}

function formatTime(t) {
  const pattern = /^\d{2}:\d{2} [A|P][M]$/;
  if (pattern.test(t)) {
    if (t[0] === "0") return t.substring(1)
    return t;
  }
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}