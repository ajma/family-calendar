import React, { useState } from 'react';

export const findPersonByEmail = (people, email) => {
  if (!email) return null;
  return people.find(p => 
    p.email === email || 
    (p.alternateEmails && p.alternateEmails.includes(email))
  );
};

export const getAttendeeColor = (attendeeEmail) => {
  const people = JSON.parse(localStorage.getItem('people') || '[]');
  const person = findPersonByEmail(people, attendeeEmail);
  return person ? person.color : 'var(--text-secondary)';
};

const AttendeeAvatar = ({ attendee, index }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Lookup person in local storage
  const people = JSON.parse(localStorage.getItem('people') || '[]');
  const person = findPersonByEmail(people, attendee.email);

  // Fallbacks if not found
  const name = person ? person.name : (attendee.displayName || attendee.email || 'Unknown');
  const initials = person ? person.initials : name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const bgColor = person ? person.color : 'var(--surface-hover)';

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
