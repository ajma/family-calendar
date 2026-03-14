import { GoogleCalendarEvent } from '../../common/types';

/**
 * Logic for processing, deduplicating, and sorting Google Calendar events.
 */
export function processEvents(allEvents: GoogleCalendarEvent[]): GoogleCalendarEvent[] {
    // 1. Deduplicate, filter private/#ignore events
    const seenIds = new Set();
    const uniqueEvents = [];

    for (const event of allEvents) {
        if (event.visibility === 'private') continue;
        if (event.description?.includes('#ignore')) continue;
        
        if (!seenIds.has(event.id)) {
            seenIds.add(event.id);
            uniqueEvents.push(event);
        }
    }

    // 2. Sort chronologically
    uniqueEvents.sort((a, b) => {
        const tA = new Date(a.start.dateTime || a.start.date || '').getTime();
        const tB = new Date(b.start.dateTime || b.start.date || '').getTime();
        return tA - tB;
    });

    return uniqueEvents;
}
