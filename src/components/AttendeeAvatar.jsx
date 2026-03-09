import React, { useState } from 'react';

export const getAttendeeColor = (attendee) => {
  const name = attendee.displayName || attendee.email || 'Unknown';
  const colors = ['var(--accent-blue)', 'var(--accent-purple)', 'var(--accent-green)', 'var(--accent-orange)', '#f778ba'];
  const colorIndex = name.length % colors.length;
  return colors[colorIndex];
};

const AttendeeAvatar = ({ attendee, index }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Get initials
  const name = attendee.displayName || attendee.email || 'Unknown';
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const bgColor = getAttendeeColor(attendee);

  return (
    <div 
      className="attendee-avatar"
      style={{ 
        backgroundColor: bgColor,
        zIndex: 10 - index // Stack properly
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {initials}
      
      {isHovered && (
        <div className="attendee-tooltip glass">
          {name}
        </div>
      )}
    </div>
  );
};

export default AttendeeAvatar;
