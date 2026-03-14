import React from 'react';
import AttendeeAvatar, { getAttendeeColor } from './AttendeeAvatar';

const formatTime = (isoString: string | undefined) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

import { GoogleCalendarEvent } from 'common/types';

interface EventCardProps {
  event: GoogleCalendarEvent;
  currentDay: Date;
}

const EventCard: React.FC<EventCardProps> = ({ event, currentDay }) => {
  // Helpers for multiday logic
  const isAllDay = !!event.start.date;
  
  const getDisplayTime = () => {
    if (isAllDay) return 'All Day';
    if (!event.start.dateTime || !event.end.dateTime) return 'All Day';
    if (!currentDay) return `${formatTime(event.start.dateTime)} - ${formatTime(event.end.dateTime)}`;

    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    
    // Normalize currentDay to start of day for comparison
    const dayStart = new Date(currentDay);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDay);
    dayEnd.setHours(23, 59, 59, 999);

    const startsBeforeToday = start < dayStart;
    const endsAfterToday = end > dayEnd;

    const startTimeStr = formatTime(event.start.dateTime);
    const endTimeStr = formatTime(event.end.dateTime);

    if (startsBeforeToday && endsAfterToday) {
      return 'All Day';
    } else if (startsBeforeToday) {
      return `→ ${endTimeStr}`;
    } else if (endsAfterToday) {
      return `${startTimeStr} →`;
    } else {
      return `${startTimeStr} - ${endTimeStr}`;
    }
  };

  const timeString = getDisplayTime();

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
    if (colors.length > 1) {
      const step = 100 / colors.length;
      const gradientStops = colors.map((c, i) => `${c} ${i * step}%, ${c} ${(i + 1) * step}%`).join(', ');
      borderIndicatorStyle = { background: `linear-gradient(to bottom, ${gradientStops})` };
    } else {
      borderIndicatorStyle = { background: colors[0] };
    }
  }

  const summary = event.summary || 'Untitled Event';
  // Calculate dynamic font size based on text length
  // Default is 0.9rem. Start shrinking after 30 characters.
  const dynamicFontSize = summary.length > 30 
    ? Math.max(0.65, 0.9 - (summary.length - 30) * 0.005) + 'rem'
    : '0.9rem';

  return (
    <div className="event-card glass">
      <div className="event-card-border" style={borderIndicatorStyle}></div>
      <div className="event-time">{timeString}</div>
      <h3 className="event-title" style={{ fontSize: dynamicFontSize }}>{summary}</h3>

      {attendees.length > 0 && (
        <div className="event-attendees">
          {attendees.slice(0, 6).map((attendee, index) => (
            <AttendeeAvatar key={index} attendee={{ email: attendee.email!, displayName: attendee.displayName }} index={index} />
          ))}
          {attendees.length > 6 && (
            <div className="attendee-overflow">+{attendees.length - 6}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventCard;
