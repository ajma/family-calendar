import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEvents, fetchCalendars } from '../../services/googleCalendar';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TIME_MIN = '2024-03-11T00:00:00.000Z';
const TIME_MAX = '2024-03-17T23:59:59.999Z';

const makeEvent = (overrides = {}) => ({
  id: 'evt-default',
  summary: 'Default Event',
  start: { dateTime: '2024-03-13T09:00:00Z' },
  end:   { dateTime: '2024-03-13T10:00:00Z' },
  ...overrides,
});

/** Returns a mock fetch response that yields the given events array. */
const calResponse = (items = []) => ({
  ok: true,
  json: async () => ({ items }),
});

/** Returns a mock fetch response that yields a calendar list. */
const calListResponse = (items = []) => ({
  ok: true,
  json: async () => ({ items }),
});

// ─── fetchCalendars ──────────────────────────────────────────────────────────

describe('fetchCalendars', () => {
  it('throws if no access token is provided', async () => {
    await expect(fetchCalendars(null)).rejects.toThrow('Access token is required.');
  });

  it('returns an empty array when the API returns no items', async () => {
    global.fetch = vi.fn().mockResolvedValue(calListResponse([]));
    const result = await fetchCalendars('fake-token');
    expect(result).toEqual([]);
  });

  it('returns items from the API response', async () => {
    const calendars = [
      { id: 'cal-1', summary: 'Personal', primary: true },
      { id: 'cal-2', summary: 'Work' },
    ];
    global.fetch = vi.fn().mockResolvedValue(calListResponse(calendars));
    const result = await fetchCalendars('fake-token');
    expect(result).toHaveLength(2);
    expect(result[0].summary).toBe('Personal');
  });

  it('throws a descriptive error on non-OK response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid Credentials' } }),
    });
    await expect(fetchCalendars('bad-token')).rejects.toThrow('Invalid Credentials');
  });
});

// ─── fetchEvents ─────────────────────────────────────────────────────────────

describe('fetchEvents', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws if no access token is provided', async () => {
    await expect(fetchEvents(null, ['cal-1'], TIME_MIN, TIME_MAX)).rejects.toThrow(
      'Access token is required'
    );
  });

  it('returns empty array immediately for an empty calendarIds list', async () => {
    global.fetch = vi.fn();
    const result = await fetchEvents('token', [], TIME_MIN, TIME_MAX);
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('stamps each event with its source _calendarId', async () => {
    global.fetch = vi.fn().mockResolvedValue(calResponse([makeEvent({ id: 'evt-1' })]));
    const result = await fetchEvents('token', ['work-cal'], TIME_MIN, TIME_MAX);
    expect(result[0]._calendarId).toBe('work-cal');
  });

  // ── Deduplication ──────────────────────────────────────────────────────────

  it('deduplicates events with the same ID shared across calendars', async () => {
    const sharedEvent = makeEvent({ id: 'shared-evt' });
    global.fetch = vi.fn()
      .mockResolvedValueOnce(calResponse([sharedEvent]))
      .mockResolvedValueOnce(calResponse([sharedEvent]));

    const result = await fetchEvents('token', ['cal-a', 'cal-b'], TIME_MIN, TIME_MAX);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('shared-evt');
  });

  it('keeps distinct events from multiple calendars', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(calResponse([makeEvent({ id: 'evt-1', summary: 'Meeting' })]))
      .mockResolvedValueOnce(calResponse([makeEvent({ id: 'evt-2', summary: 'Lunch' })]));

    const result = await fetchEvents('token', ['cal-a', 'cal-b'], TIME_MIN, TIME_MAX);
    expect(result).toHaveLength(2);
  });

  // ── Filtering ─────────────────────────────────────────────────────────────

  it('filters out events with visibility: "private"', async () => {
    const events = [
      makeEvent({ id: 'evt-public' }),
      makeEvent({ id: 'evt-private', visibility: 'private' }),
    ];
    global.fetch = vi.fn().mockResolvedValue(calResponse(events));

    const result = await fetchEvents('token', ['cal-a'], TIME_MIN, TIME_MAX);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('evt-public');
  });

  it('filters out events with #ignore in the description', async () => {
    const events = [
      makeEvent({ id: 'evt-normal', description: 'Regular event' }),
      makeEvent({ id: 'evt-ignored', description: 'Skip this one #ignore please' }),
    ];
    global.fetch = vi.fn().mockResolvedValue(calResponse(events));

    const result = await fetchEvents('token', ['cal-a'], TIME_MIN, TIME_MAX);
    expect(result).toHaveLength(1);
    expect(result.find(e => e.id === 'evt-ignored')).toBeUndefined();
  });

  // ── Sorting ───────────────────────────────────────────────────────────────

  it('returns events in chronological order', async () => {
    const events = [
      makeEvent({ id: 'evt-late',  start: { dateTime: '2024-03-13T14:00:00Z' }, end: { dateTime: '2024-03-13T15:00:00Z' } }),
      makeEvent({ id: 'evt-early', start: { dateTime: '2024-03-13T08:00:00Z' }, end: { dateTime: '2024-03-13T09:00:00Z' } }),
      makeEvent({ id: 'evt-mid',   start: { dateTime: '2024-03-13T11:00:00Z' }, end: { dateTime: '2024-03-13T12:00:00Z' } }),
    ];
    global.fetch = vi.fn().mockResolvedValue(calResponse(events));

    const result = await fetchEvents('token', ['cal-a'], TIME_MIN, TIME_MAX);
    expect(result.map(e => e.id)).toEqual(['evt-early', 'evt-mid', 'evt-late']);
  });

  it('handles all-day events (start.date only) without crashing', async () => {
    const allDayEvent = makeEvent({ id: 'all-day', start: { date: '2024-03-13' }, end: { date: '2024-03-14' } });
    delete allDayEvent.start.dateTime;
    delete allDayEvent.end.dateTime;
    global.fetch = vi.fn().mockResolvedValue(calResponse([allDayEvent]));

    const result = await fetchEvents('token', ['cal-a'], TIME_MIN, TIME_MAX);
    expect(result).toHaveLength(1);
  });

  // ── Graceful degradation ──────────────────────────────────────────────────

  it('still returns events from other calendars when one calendar fetch fails (404)', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }) // cal-a fails
      .mockResolvedValueOnce(calResponse([makeEvent({ id: 'evt-b' })]));     // cal-b succeeds

    const result = await fetchEvents('token', ['cal-a', 'cal-b'], TIME_MIN, TIME_MAX);
    expect(result).toHaveLength(1);
    expect(result[0]._calendarId).toBe('cal-b');
  });

  // ── Hashtag query param ───────────────────────────────────────────────────

  it('appends a hashtag search query when a calendar has a hashtag config', async () => {
    global.fetch = vi.fn().mockResolvedValue(calResponse([]));
    await fetchEvents('token', ['cal-a'], TIME_MIN, TIME_MAX, { 'cal-a': '#work' });

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('q=%23work');
  });

  it('does not append q param for calendars without a hashtag config', async () => {
    global.fetch = vi.fn().mockResolvedValue(calResponse([]));
    await fetchEvents('token', ['cal-a'], TIME_MIN, TIME_MAX, {});

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).not.toContain('q=');
  });
});
