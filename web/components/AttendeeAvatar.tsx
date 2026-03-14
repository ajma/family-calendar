import React, { useState } from 'react';

export const findPersonByEmail = (people: Person[], email: string | undefined): Person | null => {
  if (!email) return null;
  const lowerEmail = email.toLowerCase();
  return people.find(p => 
    (p.email && p.email.toLowerCase() === lowerEmail) || 
    (p.alternateEmails && p.alternateEmails.some(ae => ae.toLowerCase() === lowerEmail))
  ) || null;
};

export const getAttendeeColor = (attendeeEmail: string): string => {
  const people: Person[] = JSON.parse(localStorage.getItem('people') || '[]');
  const person = findPersonByEmail(people, attendeeEmail);
  return person ? person.color : 'var(--text-secondary)';
};

import { Person } from 'common/types';

interface AttendeeAvatarProps {
  attendee: { email: string; displayName?: string };
  index: number;
}

const AttendeeAvatar: React.FC<AttendeeAvatarProps> = ({ attendee, index }) => {
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
