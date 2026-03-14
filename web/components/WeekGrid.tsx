import React from 'react';
import DayColumn from './DayColumn';

import { GoogleCalendarEvent } from 'common/types';

interface WeekGridProps {
  currentDate: Date;
  events: GoogleCalendarEvent[];
}

const WeekGrid: React.FC<WeekGridProps> = ({ currentDate, events }) => {
  // Calculate the start of the week (Monday)
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0,0,0,0);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push(d);
  }

  // Group events by day
  const eventsByDay: Record<string, GoogleCalendarEvent[]> = {};
  days.forEach(d => {
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);
    
    // using YYYY-MM-DD as key
    const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    eventsByDay[dayStr] = events.filter(event => {
      if (event.start.date && event.end.date) {
        // All-day event: use string comparison for safety.
        // Google end dates are exclusive, so we check dayStr < end.date
        return dayStr >= event.start.date && dayStr < event.end.date;
      } else if (event.start.dateTime && event.end.dateTime) {
        // Timed event: check for any overlap with the current day
        const start = new Date(event.start.dateTime);
        const end = new Date(event.end.dateTime);
        return start <= dayEnd && end >= dayStart;
      }
      return false;
    });
  });

  return (
    <div className="week-grid animate-in">
      {days.map((date, index) => {
        const dayStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayEvents = eventsByDay[dayStr];
        
        return (
          <DayColumn 
            key={index} 
            date={date} 
            events={dayEvents} 
            isToday={new Date().toDateString() === date.toDateString()}
          />
        );
      })}
    </div>
  );
};

export default WeekGrid;
