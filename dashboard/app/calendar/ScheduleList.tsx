"use client";

import { useMemo, useState } from "react";
import TaskStatusIcon from "./TaskStatusIcon";

type ChipColor = "jade" | "amber" | "red" | "blue" | "grey";

type ScheduleEvent = {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  patientName?: string | null;
  status: "PENDING" | "COMPLETE" | "ARCHIVED";
  dueDate?: string;
};

interface ScheduleListProps {
  events: ScheduleEvent[];
  selectedDate: string | null;
  onClose: () => void;
  onSelectEvent: (id: string) => void;
  selectedEventId?: string | null
  onToggleComplete: (id: string) => void;
  getTaskStatus: (event: ScheduleEvent) => string;
};

export default function ScheduleList({ events, selectedDate, onClose, onSelectEvent, selectedEventId, onToggleComplete, getTaskStatus}: ScheduleListProps) 
{
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const selectedDayEvents = useMemo(() => {

    if (!selectedDate) return [];

    return events
      .filter((event) => event.date === selectedDate)
      .sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });

      }, [events, selectedDate]);


  const day = selectedDate ? new Date(`${selectedDate}T00:00:00-07:00`) : null;

  function convertMilitaryToStandard(militaryTime: string): string {
  // Split input into hours and minutes
  const [hoursStr, minutesStr, secondsStr] = militaryTime.split(':');
  
  const hours = parseInt(hoursStr, 10);
  
  // Determine AM or PM suffix
  const period = hours >= 12 ? 'PM' : 'AM';
  
  // Convert hour 0 to 12, and hours 13-23 to 1-11
  const standardHours = hours % 12 || 12;
  
  // Reconstruct string (supports HH:MM or HH:MM:SS)
  const suffix = secondsStr ? `:${secondsStr}` : '';
  return `${standardHours}:${minutesStr}${suffix} ${period}`;
}

console.log(events);

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-black/5"
      style={{
        boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)'
      }}
    >
      <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between bg-gradient-to-b from-white via-white to-gray-50/30">
        <div className="font-bold text-[18px] text-[#1C1C1E] flex items-center gap-2">
          Schedule for {day?.toLocaleString('en-US', {month: 'long'})} {day?.getDate()}, {day?.getFullYear()} {" "}
          <span className="text-gray-400 font-normal">
            · {selectedDayEvents.length}
          </span>
          </div>
          <button
          onClick={onClose}
          className="
            text-gray-500
            hover:text-black
            text-xl
            
          "
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col">
             {selectedDayEvents.length === 0 ? (
          <div className="px-6 py-6 text-gray-500 text-sm">
            No events scheduled.
          </div>
        ) : (
          selectedDayEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => {
                const next = selectedEvent === event.id ? null : event.id;
                setSelectedEvent(next)
                onSelectEvent(next ?? "");
              }
              }
              className={`
                grid grid-cols-[80px_1fr]
                gap-4 items-center
                px-5 py-3.5
                border-b border-black/5
                hover:bg-gray-50
                cursor-pointer
                ${selectedEventId === event.id ? "bg-gray-50" : ""}
              `}
            >
              <div className="font-mono text-[15px] text-gray-600 font-medium">
                {event.time ? convertMilitaryToStandard(event.time) : null}
              </div>

              <div>
               <div className="font-semibold text-[15px] text-[#1C1C1E] flex items-center gap-2">
  <TaskStatusIcon
    status={getTaskStatus(event)}
    dueDate={event.dueDate}
  />

  <span>
    {event.patientName ?? event.title}
  </span>
</div>

                {event.description && (
                  <div className="text-[14px] text-gray-500 mt-0.5">
                    {event.description}
                  </div>
                )}
                <input
    type="checkbox"
    checked={event.status === "COMPLETE"}
    onChange={(e) => {
      e.stopPropagation();
      onToggleComplete(event.id);
    }}
/>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
