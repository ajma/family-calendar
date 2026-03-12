/**
 * Pure utility functions for annotating and filtering calendar events.
 * Extracted from App.jsx to make the logic independently testable.
 */

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
  return events.map(event => {
    const config = calendarConfigs[event._calendarId] || {};
    const assignedEmail = config.assignment;
    const calendarEmoji = config.emoji;

    let updatedEvent = { ...event };

    // Prepend emoji to event title
    if (calendarEmoji && updatedEvent.summary) {
      updatedEvent.summary = `${calendarEmoji} ${updatedEvent.summary}`;
    }

    // Auto-assign the calendar's designated person as an attendee
    if (assignedEmail) {
      const person = people.find(p => p.email === assignedEmail);
      const attendees = updatedEvent.attendees ? [...updatedEvent.attendees] : [];
      if (person && !attendees.some(a => a.email === assignedEmail)) {
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
        if (!attendees.some(a => a.email === person.email)) {
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
  return events.map(event => {
    if (!event.attendees) return event;
    const filteredAttendees = event.attendees.filter(att => {
      const person = people.find(p => p.email === att.email);
      return !(person && person.show === false);
    });
    return { ...event, attendees: filteredAttendees };
  });
}
