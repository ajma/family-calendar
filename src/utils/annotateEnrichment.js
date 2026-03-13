/**
 * Pure utility functions for annotating and filtering calendar events.
 * Extracted from App.jsx to make the logic independently testable.
 */

/**
 * Builds a lookup map from any email (primary or alternate) to a person record.
 * @param {object[]} people
 * @returns {Map<string, object>}
 */
export function buildEmailMap(people) {
  const map = new Map();
  people.forEach(person => {
    if (person.email) map.set(person.email.toLowerCase(), person);
    (person.alternateEmails || []).forEach(ae => {
      if (ae) map.set(ae.toLowerCase(), person);
    });
  });
  return map;
}

/**
 * Rewrites each attendee's email to the primary email of the matched person,
 * then deduplicates attendees (keeping the first occurrence of each primary email).
 * @param {object[]} attendees
 * @param {Map<string, object>} emailMap - built by buildEmailMap
 * @returns {object[]}
 */
export function normalizeAttendees(attendees, emailMap) {
  if (!attendees) return attendees;
  const seen = new Set();
  const result = [];
  for (const att of attendees) {
    const person = att.email ? emailMap.get(att.email.toLowerCase()) : null;
    const resolvedEmail = person ? person.email : att.email;
    if (resolvedEmail && seen.has(resolvedEmail.toLowerCase())) continue; // dedup
    if (resolvedEmail) seen.add(resolvedEmail.toLowerCase());
    // Preserve the original attendee object (don't overwrite email/name)
    result.push(att);
  }
  return result;
}

/**
 * Annotates a list of raw events from the Google Calendar API by:
 *  - Prepending the calendar emoji to each event's summary
 *  - Auto-assigning the calendar's configured person as an attendee
 *  - Adding all people as attendees for events tagged with #allfamily
 *
 * @param {object[]} events - Raw events (each should have a `_calendarId` field)
 * @param {object}   calendarConfigs - Map of calendarId -> config ({ emoji, assignment, ... })
 * @param {object[]} people - The current peopleDB array
 * @returns {object[]} A new array of annotated events (original objects are not mutated)
 */
export function annotateEvents(events, calendarConfigs, people) {
  const emailMap = buildEmailMap(people);
  return events.map(event => {
    const config = calendarConfigs[event._calendarId] || {};
    const assignedEmail = config.assignment;
    const calendarEmoji = config.emoji;

    let updatedEvent = { ...event };

    // Normalize and deduplicate attendees using alternateEmails
    if (updatedEvent.attendees) {
      updatedEvent.attendees = normalizeAttendees(updatedEvent.attendees, emailMap);
    }

    // Prepend emoji to event title
    if (calendarEmoji && updatedEvent.summary) {
      updatedEvent.summary = `${calendarEmoji} ${updatedEvent.summary}`;
    }

    // Auto-assign the calendar's designated person as an attendee
    if (assignedEmail) {
      const person = emailMap.get(assignedEmail.toLowerCase());
      const attendees = updatedEvent.attendees ? [...updatedEvent.attendees] : [];
      if (person && !attendees.some(a => a.email && a.email.toLowerCase() === person.email.toLowerCase())) {
        attendees.push({
          email: person.email,
          displayName: person.name || person.email,
          responseStatus: 'accepted',
        });
        updatedEvent.attendees = attendees;
      }
    }

    // Add every known person as an attendee for #allfamily events
    if (updatedEvent.description && updatedEvent.description.toLowerCase().includes('#allfamily')) {
      const attendees = updatedEvent.attendees ? [...updatedEvent.attendees] : [];
      let attendeesModified = false;

      people.forEach(person => {
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
 *
 * @param {object[]} events  - Annotated events
 * @param {object[]} people  - The current peopleDB array
 * @returns {object[]} Events with hidden attendees removed
 */
export function filterHiddenAttendees(events, people) {
  const emailMap = buildEmailMap(people);
  return events.map(event => {
    if (!event.attendees) return event;
    
    // First, filter out hidden people
    const filteredAttendees = event.attendees.filter(att => {
      const person = att.email ? emailMap.get(att.email.toLowerCase()) : null;
      return !(person && person.show === false);
    });

    // Then, re-normalize and deduplicate in case people were recently merged/changed
    const normalizedAttendees = normalizeAttendees(filteredAttendees, emailMap);
    
    return { ...event, attendees: normalizedAttendees };
  });
}
