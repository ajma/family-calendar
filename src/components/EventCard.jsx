import React from 'react';
import AttendeeAvatar, { getAttendeeColor } from './AttendeeAvatar';

const formatTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const EventCard = ({ event }) => {
  // Extract time from event
  const startTime = formatTime(event.start.dateTime);
  const endTime = formatTime(event.end.dateTime);
  const timeString = startTime ? `${startTime} - ${endTime}` : 'All Day';

  // Extract attendees
  const rawAttendees = event.attendees || [];
  const attendees = [...rawAttendees].sort((a, b) => {
    const nameA = a.displayName || a.email || '';
    const nameB = b.displayName || b.email || '';
    return nameA.localeCompare(nameB);
  });

  let borderIndicatorStyle = {};
  if (attendees.length === 0) {
    borderIndicatorStyle = { background: 'var(--text-secondary)' };
  } else if (attendees.length === 1) {
    borderIndicatorStyle = { background: getAttendeeColor(attendees[0].email) };
  } else {
    // Remove duplicates to keep gradient clean if repeating colors
    const colors = Array.from(new Set(attendees.map(a => getAttendeeColor(a.email))));
    borderIndicatorStyle = { background: colors.length > 1 ? `linear-gradient(to bottom, ${colors.join(', ')})` : colors[0] };
  }

  return (
    <div className="event-card glass">
      <div className="event-card-border" style={borderIndicatorStyle}></div>
      <div className="event-time">{timeString}</div>
      <h3 className="event-title">{event.summary || 'Untitled Event'}</h3>

      {attendees.length > 0 && (
        <div className="event-attendees">
          {attendees.slice(0, 5).map((attendee, index) => (
            <AttendeeAvatar key={index} attendee={attendee} index={index} />
          ))}
          {attendees.length > 5 && (
            <div className="attendee-overflow">+{attendees.length - 5}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventCard;
