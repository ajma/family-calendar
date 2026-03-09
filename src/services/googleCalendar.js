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

export const fetchEvents = async (accessToken, calendarId = 'primary', timeMin, timeMax) => {
  if (!accessToken) {
    throw new Error('Access token is required to fetch events.');
  }

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

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Google Calendar API Error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
};
