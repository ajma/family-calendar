import React from 'react';
import DayColumn from './DayColumn';

const WeekGrid = ({ currentDate, events }) => {
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
  const eventsByDay = {};
  days.forEach(d => {
    // using YYYY-MM-DD as key
    const currentDayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    eventsByDay[currentDayStr] = [];
  });

  events.forEach(event => {
    const eDate = new Date(event.start.dateTime || event.start.date);
    const dayStr = `${eDate.getFullYear()}-${String(eDate.getMonth() + 1).padStart(2, '0')}-${String(eDate.getDate()).padStart(2, '0')}`;
    if (eventsByDay[dayStr]) {
      eventsByDay[dayStr].push(event);
    }
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
