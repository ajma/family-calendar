import { Person, CalendarConfig, GoogleCalendarEvent, Attendee, HiddenEvent } from 'common/types';

export const HIDDEN_EVENT_RETENTION_MONTHS = 6;

/**
 * Pure utility functions for annotating and filtering calendar events.
 * Extracted from App.tsx to make the logic independently testable.
 */

/**
 * Builds a lookup map from any email (primary or alternate) to a person record.
 */
export function buildEmailMap(people: Person[]): Map<string, Person> {
  const map = new Map<string, Person>();
  people.forEach((person: Person) => {
    if (person.email) map.set(person.email.toLowerCase(), person);
    (person.alternateEmails || []).forEach((ae: string) => {
      if (ae) map.set(ae.toLowerCase(), person);
    });
  });
  return map;
}

/**
 * Rewrites each attendee's email to the primary email of the matched person,
 * then deduplicates attendees (keeping the first occurrence of each primary email).
 */
export function normalizeAttendees(attendees: Attendee[] | undefined, emailMap: Map<string, Person>): Attendee[] | undefined {
  if (!attendees) return attendees;
  const seen = new Set<string>();
  const result: Attendee[] = [];
  for (const att of attendees) {
    const person = att.email ? emailMap.get(att.email.toLowerCase()) : null;
    const resolvedEmail = person ? person.email : att.email;
    
    if (resolvedEmail && seen.has(resolvedEmail.toLowerCase())) continue; // dedup
    if (resolvedEmail) seen.add(resolvedEmail.toLowerCase());
    
    if (person) {
      result.push({
        ...att,
        email: person.email,
        displayName: person.name || person.email
      });
    } else {
      result.push(att);
    }
  }
  return result;
}

/**
 * Annotates a list of raw events from the Google Calendar API by:
 *  - Prepending the calendar emoji to each event's summary
 *  - Auto-assigning the calendar's configured person as an attendee
 *  - Adding all people as attendees for events tagged with #allfamily
 */
export function annotateEvents(events: GoogleCalendarEvent[], calendarConfigs: Record<string, CalendarConfig>, people: Person[]): GoogleCalendarEvent[] {
  const emailMap = buildEmailMap(people);
  return events.map((event: GoogleCalendarEvent) => {
    const config = calendarConfigs[event._calendarId || ''] || {};
    const assignedEmails = config.assignments || [];
    const calendarEmoji = config.emoji;
    
    // Check universally if this event ID is hidden in ANY calendar's config to deduplicate
    const isHidden = Object.values(calendarConfigs).some(c => 
      c.hiddenEvents?.some(item => (typeof item === 'string' ? item : item.id) === event.id)
    );

    let updatedEvent = { ...event };
    
    if (isHidden) {
      updatedEvent._hidden = true;
    }

    // Normalize and deduplicate attendees using alternateEmails
    if (updatedEvent.attendees) {
      updatedEvent.attendees = normalizeAttendees(updatedEvent.attendees, emailMap);
    }

    // Prepend emoji to event title
    if (calendarEmoji && updatedEvent.summary) {
      updatedEvent.summary = `${calendarEmoji} ${updatedEvent.summary}`;
    }

    // Auto-assign the calendar's designated people as attendees
    if (assignedEmails.length > 0) {
      const attendees: Attendee[] = updatedEvent.attendees ? [...updatedEvent.attendees] : [];
      let added = false;
      assignedEmails.forEach(email => {
        const person = emailMap.get(email.toLowerCase());
        if (person && !attendees.some(a => a.email && a.email.toLowerCase() === person.email.toLowerCase())) {
          attendees.push({
            email: person.email,
            displayName: person.name || person.email,
            responseStatus: 'accepted',
          });
          added = true;
        }
      });
      if (added || updatedEvent.attendees !== undefined) {
        updatedEvent.attendees = attendees;
      }
    }

    // Add every known person as an attendee for #allfamily events
    if (updatedEvent.description && updatedEvent.description.toLowerCase().includes('#allfamily')) {
      const attendees: Attendee[] = updatedEvent.attendees ? [...updatedEvent.attendees] : [];
      let attendeesModified = false;

      people.forEach((person: Person) => {
        if (!attendees.some(a => a.email && a.email.toLowerCase() === person.email.toLowerCase())) {
          attendees.push({
            email: person.email,
            displayName: person.name || person.email,
            responseStatus: 'accepted',
          });
          attendeesModified = true;
        }
      });

      if (attendeesModified) {
        updatedEvent.attendees = attendees;
      }
    }

    return updatedEvent;
  });
}

/**
 * Filters attendees whose `show` flag is explicitly set to false.
 */
export function filterHiddenAttendees(events: GoogleCalendarEvent[], people: Person[]): GoogleCalendarEvent[] {
  const emailMap = buildEmailMap(people);
  return events.map((event: GoogleCalendarEvent) => {
    if (!event.attendees) return event;
    
    // First, filter out hidden people
    const filteredAttendees = event.attendees.filter((att: Attendee) => {
      const person = att.email ? emailMap.get(att.email.toLowerCase()) : null;
      return !(person && person.show === false);
    });

    // Then, re-normalize and deduplicate in case people were recently merged/changed
    const normalizedAttendees = normalizeAttendees(filteredAttendees, emailMap);
    
    return { ...event, attendees: normalizedAttendees };
  });
}

/**
 * Prunes hidden event entries from calendar configurations if they have expired.
 */
export function cleanupHiddenEvents(configs: Record<string, CalendarConfig>, retentionMonths: number = HIDDEN_EVENT_RETENTION_MONTHS): Record<string, CalendarConfig> {
  const newConfigs = { ...configs };
  let modified = false;
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

  Object.keys(newConfigs).forEach(calId => {
    const config = newConfigs[calId];
    if (config.hiddenEvents && config.hiddenEvents.length > 0) {
      const originalCount = config.hiddenEvents.length;
      const filtered = config.hiddenEvents.filter(item => {
        if (typeof item === 'string') return true; 
        const expiryDate = new Date(item.expiry);
        return expiryDate > cutoffDate;
      });
      
      if (filtered.length !== originalCount) {
        newConfigs[calId] = { ...config, hiddenEvents: filtered };
        modified = true;
      }
    }
  });
  return modified ? newConfigs : configs;
}
