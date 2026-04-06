/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { processEvents } from '../services/eventService';
import { GoogleCalendarEvent } from '../../common/types';

const makeEvent = (overrides: Partial<GoogleCalendarEvent> = {}): GoogleCalendarEvent => ({
  id: 'evt-1',
  summary: 'Test Event',
  start: { dateTime: '2024-03-13T09:00:00Z' },
  end: { dateTime: '2024-03-13T10:00:00Z' },
  ...overrides,
});

describe('processEvents', () => {
  describe('deduplication', () => {
    it('removes duplicate events by id', () => {
      const events = [
        makeEvent({ id: 'a', summary: 'First' }),
        makeEvent({ id: 'a', summary: 'Duplicate' }),
        makeEvent({ id: 'b', summary: 'Second' }),
      ];
      const result = processEvents(events);
      expect(result).toHaveLength(2);
      expect(result[0].summary).toBe('First');
      expect(result[1].summary).toBe('Second');
    });

    it('keeps the first occurrence when duplicates exist', () => {
      const events = [
        makeEvent({ id: 'x', summary: 'Original', _calendarId: 'cal-1' }),
        makeEvent({ id: 'x', summary: 'Copy', _calendarId: 'cal-2' }),
      ];
      const result = processEvents(events);
      expect(result).toHaveLength(1);
      expect(result[0].summary).toBe('Original');
    });
  });

  describe('filtering', () => {
    it('filters out private events', () => {
      const events = [
        makeEvent({ id: '1', visibility: 'private' }),
        makeEvent({ id: '2', visibility: 'public' }),
        makeEvent({ id: '3' }),
      ];
      const result = processEvents(events);
      expect(result).toHaveLength(2);
      expect(result.every(e => e.visibility !== 'private')).toBe(true);
    });

    it('filters out events with #ignore in description', () => {
      const events = [
        makeEvent({ id: '1', description: 'Regular meeting' }),
        makeEvent({ id: '2', description: 'Please #ignore this event' }),
        makeEvent({ id: '3' }),
      ];
      const result = processEvents(events);
      expect(result).toHaveLength(2);
      expect(result.find(e => e.id === '2')).toBeUndefined();
    });

    it('keeps events without a description', () => {
      const events = [makeEvent({ id: '1', description: undefined })];
      const result = processEvents(events);
      expect(result).toHaveLength(1);
    });

    it('does not filter events with visibility "default"', () => {
      const events = [makeEvent({ id: '1', visibility: 'default' })];
      const result = processEvents(events);
      expect(result).toHaveLength(1);
    });
  });

  describe('sorting', () => {
    it('sorts events chronologically by start time', () => {
      const events = [
        makeEvent({ id: '3', summary: 'Late', start: { dateTime: '2024-03-13T15:00:00Z' } }),
        makeEvent({ id: '1', summary: 'Early', start: { dateTime: '2024-03-13T08:00:00Z' } }),
        makeEvent({ id: '2', summary: 'Mid', start: { dateTime: '2024-03-13T12:00:00Z' } }),
      ];
      const result = processEvents(events);
      expect(result.map(e => e.summary)).toEqual(['Early', 'Mid', 'Late']);
    });

    it('sorts all-day events (start.date) before timed events on the same day', () => {
      const events = [
        makeEvent({ id: '2', summary: 'Timed', start: { dateTime: '2024-03-13T09:00:00Z' } }),
        makeEvent({ id: '1', summary: 'All Day', start: { date: '2024-03-13' }, end: { date: '2024-03-14' } }),
      ];
      const result = processEvents(events);
      // All-day date "2024-03-13" parses to midnight UTC, which is before 09:00 UTC
      expect(result[0].summary).toBe('All Day');
      expect(result[1].summary).toBe('Timed');
    });
  });

  describe('combined behavior', () => {
    it('deduplicates, filters, and sorts in one pass', () => {
      const events = [
        makeEvent({ id: 'c', summary: 'Late', start: { dateTime: '2024-03-13T15:00:00Z' } }),
        makeEvent({ id: 'a', summary: 'Private', visibility: 'private' }),
        makeEvent({ id: 'b', summary: 'Early', start: { dateTime: '2024-03-13T08:00:00Z' } }),
        makeEvent({ id: 'c', summary: 'Dup of Late' }),
        makeEvent({ id: 'd', summary: 'Ignored', description: '#ignore' }),
      ];
      const result = processEvents(events);
      expect(result).toHaveLength(2);
      expect(result[0].summary).toBe('Early');
      expect(result[1].summary).toBe('Late');
    });

    it('returns empty array for empty input', () => {
      expect(processEvents([])).toEqual([]);
    });
  });
});
