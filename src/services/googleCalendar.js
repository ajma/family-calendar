/**
 * Google Calendar API Service
 * Uses the OAuth access token to fetch data directly from the Google Calendar REST API.
 */

export const fetchCalendars = async (accessToken) => {
  if (!accessToken) throw new Error('Access token is required.');

  const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to fetch calendars: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
};

export const fetchEvents = async (accessToken, calendarIds = ['primary'], timeMin, timeMax) => {
  if (!accessToken) {
    throw new Error('Access token is required to fetch events.');
  }

  // Ensure calendarIds is an array
  const idsToFetch = Array.isArray(calendarIds) ? calendarIds : [calendarIds];
  if (idsToFetch.length === 0) return [];

  // If no time range provided, default to current week
  if (!timeMin || !timeMax) {
    const now = new Date();
    // Start of week (Monday)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + mondayOffset);
    startOfWeek.setHours(0, 0, 0, 0);
    timeMin = startOfWeek.toISOString();

    // End of week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    timeMax = endOfWeek.toISOString();
  }

  const queryParams = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const fetchSingleCalendar = async (calId) => {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${queryParams.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch events for calendar ${calId}`);
      return [];
    }

    const data = await response.json();
    return (data.items || []).map(event => ({ ...event, _calendarId: calId }));
  };

  try {
    // Fetch all selected calendars in parallel
    const results = await Promise.all(idsToFetch.map(id => fetchSingleCalendar(id)));
    
    // Flatten the array of arrays into a single array
    const mergedEvents = results.flat();

    // Deduplicate events by ID (if same event is shared across calendars)
    const uniqueEvents = [];
    const seenIds = new Set();
    
    for (const event of mergedEvents) {
      // Discard private events
      if (event.visibility === 'private') {
        continue;
      }

      // Discard ignored events
      if (event.description && event.description.includes('#ignore')) {
        continue;
      }

      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        uniqueEvents.push(event);
      }
    }

    // Sort the unique events chronologically
    uniqueEvents.sort((a, b) => {
      const timeA = new Date(a.start.dateTime || a.start.date).getTime();
      const timeB = new Date(b.start.dateTime || b.start.date).getTime();
      return timeA - timeB;
    });

    return uniqueEvents;
  } catch (error) {
    throw new Error(`Google Calendar API Error: ${error.message}`);
  }
};
