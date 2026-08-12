import { useState } from 'react';
import './ScheduleDashboard.css';
import Holidays from "date-holidays";
import ScheduleList from "./ScheduleList"
import TaskStatusIcon from "./TaskStatusIcon"
import NeedsReviewModal, {
  RecommendedAction,
} from "./NeedsReviewModal";

/**
 * @typedef {Object} RecommendedAction
 * @property {string} id
 * @property {string|null} emailId
 * @property {string} title
 * @property {string} summary
 * @property {string|null} dueDate
 * @property {string[]} recommendedActions
 * @property {string|null} [patientName]
 * @property {{
 *   id: string,
 *   gmailMessageId: string|null,
 *   gmailThreadId: string|null,
 *   fromName: string,
 *   fromEmail: string,
 *   subject: string,
 *   body: string,
 *   receivedAt: string
 * }|null} [email]
 */

/**
 * @typedef {Object} ScheduleDashboardProps
 * @property {Array} events
 * @property {string} status
 * @property {(event: Object) => Promise<void>} onCreateEvent
 * @property {(id: string, updates: Object) => Promise<void>} onUpdateEvent
 * @property {(id: string) => Promise<void>} onDeleteEvent
 * @property {(updater: Function) => void} onEventUpdated
 * @property {RecommendedAction[]} recommendedActions
 * @property {(action: RecommendedAction) => Promise<void>} onAcceptRecommendedAction
 * @property {(action: RecommendedAction) => Promise<void>} onRejectRecommendedAction
 * @property {(action: RecommendedAction) => void} onViewSourceEmail
 */

/**
 * @property {(action: RecommendedAction, updates: {
 *   title: string,
 *   summary: string,
 *   dueDate: string|null,
 *   patientName: string|null
 * }) => Promise} onEditRecommendedAction
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const hd = new Holidays("US")

function toMinutes(amount, unit) {
  switch (unit) {
    case "minutes":
      return amount;
    case "hours":
      return amount * 60;
    case "days":
      return amount * 60 * 24;
    case "weeks":
      return amount * 60 * 24 * 7;
    default:
      return amount;
  }
}

export default function ScheduleDashboard({ events, status, onCreateEvent, onUpdateEvent, onDeleteEvent, onEventUpdated,
  recommendedActions,
  onAcceptRecommendedAction,
  onRejectRecommendedAction,
  onEditRecommendedAction,
  onViewSourceEmail,
 }) {
  
  const m = new Date().getMonth();
  const y = new Date().getFullYear();

  const CALENDAR_DAYS = []
  const [selected, setSelected] = useState(null);
  // const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(m);
  const [currentYear, setCurrentYear] = useState(y);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    due: ""
  });
  const [reminders, setReminders] = useState([
    {
      //method: "popup",
      amount: 15,
      unit: "minutes"
    }
  ])
  const [showReminders, setShowReminders] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState("month");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showNeedsReview, setShowNeedsReview] = useState(false);

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // Sunday = 0

  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);

  return d;
}

const [currentWeek, setCurrentWeek] = useState(
  getStartOfWeek(new Date())
);

const weekDays = [...Array(7)].map((_, i) => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + i);
    return d;
});

  if (status === 'loading' || status === 'analyzing') {
    return (
      <div className="sched-loading">
        <div className="spinner" />
        <p>Extracting schedule from emails…</p>
      </div>
    );
  }

function getTaskStatus(task) {

  if (task.status === "ARCHIVED") {
        return "ARCHIVED";
  }

    if (task.status === "COMPLETE")
        return "COMPLETE";

    return "PENDING";
}

async function archiveEvent(id) {
  const res = await fetch(`/api/events/${id}/archive`, {
    method: "PATCH",
  });

  if (!res.ok) {
    console.error("Failed to archive task");
    return;
  }

  const updatedTask = await res.json();

  onEventUpdated(prev =>
    prev.map(event =>
      event.id === id
        ? {
            ...event,
            status: updatedTask.status,
          }
        : event
    )
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

async function toggleComplete(id) {
  const res = await fetch(`/api/events/${id}/complete`, {
    method: "PATCH",
  });

  if (!res.ok) {
    console.error("Failed to update task");
    return;
  }

  const updatedTask = await res.json();

  onEventUpdated(prev =>
    prev.map(event =>
      event.id === id
        ? {
            ...event,
            status: updatedTask.status,
          }
        : event
    )
  );
}

  const holidays = hd.getHolidays(currentYear);

  const holidayMap = {};

  holidays.forEach(h => {
    holidayMap[h.date.slice(0, 10)] = h.name;
  });

const firstDay = new Date(currentYear, currentMonth, 1);
const startWeekday = firstDay.getDay();

for (let i = 0; i < startWeekday; i++) {
  CALENDAR_DAYS.push({
    empty: true,
    id: `empty-${i}`,
  });
}

const lastDay = new Date(currentYear, currentMonth + 1, 0);

for (let d = 1; d <= lastDay.getDate(); d++) {
  const date = new Date(currentYear, currentMonth, d);

  CALENDAR_DAYS.push({
    empty: false,
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
  const now = new Date();

const filteredEvents = events.filter(event => {
  if (statusFilter === "ALL") return true;

  if (statusFilter === "OVERDUE") {
    return (
      event.status === "PENDING" &&
      new Date(event.dueDate) < now
    );
  }

  return event.status === statusFilter;
});

  filteredEvents.forEach(ev => {
    if (ev.date) {
      if (!byDate[ev.date]) byDate[ev.date] = [];
      byDate[ev.date].push(ev);
    } else {
      unscheduled.push(ev);
    }
  });

  function addReminder() {
  setReminders(prev => [
    ...prev,
    {
      method: "popup",
      amount: 15,
      unit: "minutes",
    },
  ]);
}

function removeReminder(index) {
  setReminders(prev => prev.filter((_, i) => i !== index));
}

function updateReminder(index, field, value) {
  setReminders(prev =>
    prev.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    )
  );
}

async function enableNotifications() {

  const permission =
    await Notification.requestPermission();

  if(permission !== "granted")
    return;


  const registration =
    await navigator.serviceWorker.register(
      "/sw.js"
    );


  const subscription =
    await registration.pushManager.subscribe({
      userVisibleOnly:true,

      applicationServerKey:
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    });


  await fetch("/api/push/subscribe", {
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:
      JSON.stringify(subscription)
  });

}

  //console.log(events)

  // Count urgent items
  // const urgentCount   = events.filter(e => e.urgency === 'high').length;
  //const deadlineCount = events.filter(e => e.type === 'deadline').length;
  //const apptCount     = events.filter(e => e.type === 'appointment' || e.type === 'reschedule').length;

  const selectedEvent = selected ? events.find(e => e.id === selected) : null;

//    console.log("EVENTS:", events);
//  console.log("SELECTED EVENT:", selectedEvent);

  return (
    <div className="sched-root">
      {/* Dashboard header */}
      <div className="sched-header">
        <div className="sched-title-area">
        <div className="sched-title-nav">

<div className="flex items-center gap-2">

  <button
    onClick={() => setViewMode("month")}
    className={
      viewMode === "month"
        ? "bg-blue-600 text-white px-3 py-1 rounded"
        : "bg-gray-200 px-3 py-1 rounded"
    }
  >
    Month
  </button>

  <button
    onClick={() => setViewMode("week")}
    className={
      viewMode === "week"
        ? "bg-blue-600 text-white px-3 py-1 rounded"
        : "bg-gray-200 px-3 py-1 rounded"
    }
  >
    Week
  </button>

</div>

<select
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
>
    <option value="ALL">All</option>
    <option value="PENDING">Pending</option>
    <option value="COMPLETE">Completed</option>
    <option value="OVERDUE">Overdue</option>
    <option value="ARCHIVED">Archived</option>
</select>

  <button
    className="month-arrow"
    onClick={() => {
  if (viewMode === "month") {
    previousMonth();
  } else {
    setCurrentWeek(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }
}}
  >
    ←
  </button>

  <h2 className="sched-title">
  {viewMode === "month"
    ? `Schedule — ${MONTHS[currentMonth]} ${currentYear}`
    : `Week of ${currentWeek.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`}
</h2>

  <button
    className="month-arrow"
    onClick={() => {
  if (viewMode === "month") {
    nextMonth();
  } else {
    setCurrentWeek(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }
}}
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
        <button onClick={enableNotifications}
        className="cursor-pointer">
Enable Notifications
</button>
        <button
        onClick={() => setShowCreateModal(true)}
        className="cursor-pointer"
>
  + New Event
</button>
<button
  onClick={() => setShowNeedsReview(true)}
  className="needs-review-button cursor-pointer"
>
  Needs Review

  {recommendedActions.length > 0 && (
    <span className="needs-review-badge">
      {recommendedActions.length}
    </span>
  )}
</button>

      </div>

      <div className="sched-body">
        {/* Calendar grid */}
        <div className="calendar-wrap">

{viewMode === "month" ? (

          <div className="calendar-grid">
            {CALENDAR_DAYS.map(day => {

            if (day.empty) {
                return (
                  <div
                    key={day.id}
                    className="cal-day cal-day--empty"
                  />
                );
              }

              const weekday = new Date(
                currentYear,
                currentMonth,
                Number(day.day)).toLocaleDateString("en-US", {
                weekday: "short",
              });
              const holidayName = holidayMap[day.date]
              const dayEvents = byDate[day.date] || [];

              const urgentCount = dayEvents.filter(ev => {
  if (ev.status !== "PENDING") return false;

  return new Date(ev.dueDate) <= now;
}).length;
              
              return (
                <div
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={`cal-day ${urgentCount >= 4 ? "cal-day--has-high" : ""} cursor-pointer`}
                >
                  <div className="cal-day-header">
                  <span className="cal-daynum">{day.day}</span>
                    <span className="cal-weekday">{weekday}</span>
                    {dayEvents.length > 0 && (
                      <span className={`cal-count ${
                        urgentCount >= 4
                        ? "cal-count-high" : "cal-count"
                      }`}>{
                        dayEvents.length}</span>
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
                          <div className="cal-event-patient flex items-center gap-2">
  <TaskStatusIcon
    status={getTaskStatus(ev)}
    dueDate={ev.dueDate}
  />

  <span>
    {ev.patientName ? ev.patientName : ev.title}
  </span>
</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}

          </div>

          ) : (

            <div className="calendar-grid week-grid">
      {weekDays.map(date => {

        const dateString = date.toISOString().split("T")[0];

        const holidayName = holidayMap[dateString];
        const dayEvents = byDate[dateString] || [];

        const urgentCount = dayEvents.filter(ev => {
  if (ev.status !== "PENDING") return false;

  return new Date(ev.dueDate) <= now;
}).length;

        return (
          <div
            key={dateString}
            onClick={() => setSelectedDate(dateString)}
            className={`calendar-day ${
    urgentCount >= 4
      ? "high"
      : ""
  }`}
          >

            <div className="cal-day-header">
              <span className="cal-daynum">
                {date.getDate()}
              </span>

              <span className="cal-weekday">
                {date.toLocaleDateString("en-US", {
                  weekday: "short",
                })}
              </span>

                    {dayEvents.length > 0 && (
                      <span className={`cal-count ${
                        urgentCount >= 4
                        ? "cal-count-high" : "cal-count"
                      }`}>{
                        dayEvents.length}</span>
                    )}

              {holidayName && (
                <div className="holiday-label">
                  🎉 {holidayName}
                </div>
              )}
            </div>

            <div className="cal-events">
              {dayEvents.map(ev => (
                <button
  key={ev.id}
  className="cal-event"
  onClick={() =>
    setSelected(selected === ev.id ? null : ev.id)
  }
>
  <div className="flex items-center gap-1">
    <TaskStatusIcon
      status={getTaskStatus(ev)}
      dueDate={ev.dueDate}
    />

    {ev.time && (
      <span className="cal-event-time">
        {formatTime(ev.time)}
      </span>
    )}
  </div>

  <div className="cal-event-patient">
    {ev.patientName ?? ev.title}
  </div>
</button>
              ))}
            </div>

          </div>
        );
      })}
    </div>

          )}

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
            onDeleteEvent={onDeleteEvent}
            onArchiveEvent={archiveEvent} />
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

              <button
  type="button"
  onClick={() => setShowReminders(!showReminders)}
>
  {showReminders ? "Hide Reminders" : "+ Add Reminders"}
</button>
{showReminders && (
  <div className="form-group">
    <label>Reminders</label>

    {reminders.map((r, index) => (
      <div
        key={index}
        className="flex gap-2 items-center mb-2"
      >

        <input
          type="number"
          min="0"
          value={r.amount}
          onChange={(e) =>
            updateReminder(index, "amount", Number(e.target.value))
          }
        />

        <select
          value={r.unit}
          onChange={(e) =>
            updateReminder(index, "unit", e.target.value)
          }
        >
          <option value="minutes">Minutes</option>
          <option value="hours">Hours</option>
          <option value="days">Days</option>
          <option value="weeks">Weeks</option>
        </select>

        <button
          type="button"
          onClick={() => removeReminder(index)}
        >
          ✕
        </button>

      </div>
    ))}

    <button
      type="button"
      onClick={addReminder}
    >
      + Add Another Reminder
    </button>

  </div>
)}

      <div className="modal-buttons">

        <button onClick={() => setShowCreateModal(false)}>
          Cancel
        </button>

        <button
          onClick={async () => {

            const dueDateTime = new Date(
              `${newEvent.date}T${newEvent.time}`
            );

            const reminderData = reminders.map(r => ({
  remindAt: new Date(
    dueDateTime.getTime() - toMinutes(r.amount, r.unit) * 60 * 1000
  ).toISOString(),
}));

            await onCreateEvent({
              title: newEvent.title,
              description: newEvent.description,
              due: dueDateTime,
              reminders: reminderData
            });

            setShowCreateModal(false);

            setNewEvent({
              title: "",
              description: "",
              date: "",
              time: "",
            });

            setReminders([
    {
        method:"popup",
        amount:15,
        unit:"minutes"
    }
]);

setShowReminders(false);
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
  onToggleComplete={toggleComplete}
  getTaskStatus={getTaskStatus}
  />
)}

<NeedsReviewModal
  isOpen={showNeedsReview}
  actions={recommendedActions}
  onClose={() => setShowNeedsReview(false)}
  onAccept={onAcceptRecommendedAction}
  onReject={onRejectRecommendedAction}
  onEdit={onEditRecommendedAction}
  onViewEmail={onViewSourceEmail}
/>

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

function convertReminder(remindAt, dueDate) {
  const diff =
    new Date(dueDate).getTime() -
    new Date(remindAt).getTime();

  const minutes = Math.round(diff / 60000);

  if (minutes % 1440 === 0) {
    return {
      amount: minutes / 1440,
      unit: "days"
    };
  }

  if (minutes % 60 === 0) {
    return {
      amount: minutes / 60,
      unit: "hours"
    };
  }

  return {
    amount: minutes,
    unit: "minutes"
  };
}

  function EditEventForm({ event, onUpdateEvent, onCancel }) {
    function createFormData(event) {
  return {
    title: event.title ?? "",
    description: event.description ?? "",
    date: event.date ?? "",
    time: toInputTime(event.time),
    reminders:
      (event.reminders ?? []).map(r =>
        convertReminder(
          r.remindAt,
          `${event.date}T${toInputTime(event.time)}`
        )
      )
  };
}

    const [formData, setFormData] = useState(() =>
      createFormData(event)
    );

function addReminder() {
  setFormData(prev => ({
    ...prev,
    reminders: [
      ...prev.reminders,
      {
        amount: 15,
        unit: "minutes"
      }
    ]
  }));
}

function removeReminder(index) {
  setFormData(prev => ({
    ...prev,
    reminders: prev.reminders.filter((_, i) => i !== index)
  }));
}

function updateReminder(index, field, value) {
  setFormData(prev => ({
    ...prev,
    reminders: prev.reminders.map((r, i) =>
      i === index
        ? {
            ...r,
            [field]: value
          }
        : r
    )
  }));
}

function handleChange(e) {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const dueDateTime = new Date(`${formData.date}T${formData.time}`);

    const reminderData = formData.reminders.map(r => ({
    remindAt: new Date(
      dueDateTime.getTime()
      -
      toMinutes(r.amount,r.unit) * 60 * 1000
    ).toISOString()
  }));

    await onUpdateEvent(event.id, {
      ...event,
      ...formData,
      dueDate: dueDateTime,
      reminders: reminderData
    });

    onCancel();
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

      <div className="form-group">

<label>Reminders</label>

{formData.reminders.map((r, index) => (
  <div
    key={index}
    className="flex gap-1 items-center mb-2"
  >

    <input
      type="number"
      min="0"
      value={r.amount ?? ""}
      onChange={(e)=>
        updateReminder(
          index,
          "amount",
          Number(e.target.value)
        )
      }
    />

    <select
      value={r.unit}
      onChange={(e)=>
        updateReminder(
          index,
          "unit",
          e.target.value
        )
      }
    >
      <option value="minutes">Minutes</option>
      <option value="hours">Hours</option>
      <option value="days">Days</option>
      <option value="weeks">Weeks</option>
    </select>


    <button
      type="button"
      onClick={() => removeReminder(index)}
    >
      ✕
    </button>

  </div>
))}


<button
  type="button"
  onClick={addReminder}
>
  + Add Reminder
</button>

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

function EventDetail({ event, onUpdateEvent, onDeleteEvent, onArchiveEvent }) {
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
       {event.emailId && (
          <div className="event-detail-section">
            <span className="detail-field">Source Email</span>

            <div className="source-email">
              <p className="event-detail-subject">
                {event.email?.subject}
              </p>

              <p className="source-email-sender">
                From: {event.email?.fromName} ({event.email?.fromEmail})
              </p>

              <p className="source-email-date">
                {new Date(event.email?.receivedAt).toLocaleString()}
              </p>

              <details className="source-email-details">
                <summary>View Email</summary>

                <div className="event-detail-body">
                  {event.email?.body.split("\n").map((line, i) =>
                    line.trim() === ""
                      ? <br key={i} />
                      : <p key={i}>{line}</p>
                  )}
                </div>
              </details>
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
<button
  onClick={() => onArchiveEvent(event.id)}
  className="cursor-pointer"
>
  Archive
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