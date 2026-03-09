import React from 'react';
import EventCard from './EventCard';

const DayColumn = ({ date, events = [], isToday }) => {
  const dayName = date.toLocaleDateString('default', { weekday: 'short' });
  const dayNumber = date.getDate();

  const sortedEvents = [...events].sort((a, b) => {
    const aIsAllDay = !!a.start.date;
    const bIsAllDay = !!b.start.date;
    
    if (aIsAllDay && !bIsAllDay) return -1;
    if (!aIsAllDay && bIsAllDay) return 1;
    
    // If both are same type, sort by start time
    const aTime = a.start.dateTime || a.start.date;
    const bTime = b.start.dateTime || b.start.date;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });

  return (
    <div className={`day-column ${isToday ? 'is-today' : ''} glass`}>
      <div className="day-header">
        <span className="day-name">{dayName}</span>
        <span className={`day-number ${isToday ? 'active-day' : ''}`}>{dayNumber}</span>
      </div>
      <div className="day-events custom-scrollbar">
        {sortedEvents.length === 0 ? (
          <div className="empty-state">No events</div>
        ) : (
          sortedEvents.map(event => (
            <EventCard key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
};

export default DayColumn;
