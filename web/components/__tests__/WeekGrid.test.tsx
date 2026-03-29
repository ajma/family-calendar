import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WeekGrid from '../WeekGrid';

vi.mock('../../context/CalendarContext', () => ({
  useCalendarContext: () => ({
    isEventEditMode: false,
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a Wednesday within the given ISO week so tests are stable
 * regardless of what day 'today' actually is.
 */
const FIXED_WEDNESDAY = new Date('2024-03-13T12:00:00Z'); // Wed 13 Mar 2024

const makeEvent = (overrides = {}) => ({
  id: 'evt-1',
  summary: 'Test Event',
  start: { dateTime: '2024-03-13T09:00:00Z' },
  end:   { dateTime: '2024-03-13T10:00:00Z' },
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WeekGrid', () => {
  it('always renders exactly 7 day columns', () => {
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[]} />);
    // DayColumn renders a .day-column div for each day
    const columns = document.querySelectorAll('.day-column');
    expect(columns).toHaveLength(7);
  });

  it('week starts on Monday (not Sunday)', () => {
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[]} />);
    const dayNames = document.querySelectorAll('.day-name');
    // The first day shown should be Mon
    expect(dayNames[0].textContent).toMatch(/^Mon/i);
  });

  it('week ends on Sunday', () => {
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[]} />);
    const dayNames = document.querySelectorAll('.day-name');
    expect(dayNames[6].textContent).toMatch(/^Sun/i);
  });

  it('places an event on the correct day column', () => {
    // The event is on Wednesday 13 Mar
    const event = makeEvent({ id: 'wed-event', summary: 'Wednesday Meeting' });
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[event]} />);
    expect(screen.getByText('Wednesday Meeting')).toBeInTheDocument();
  });

  it('does not show any empty state text in columns that have no events', () => {
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[]} />);
    // Since we removed 'No events', there should be no such text
    expect(screen.queryByText('No events')).not.toBeInTheDocument();
  });

  it('places an all-day event (start.date only) on the correct day', () => {
    const allDayEvent = {
      id: 'all-day-evt',
      summary: 'Family Holiday',
      start: { date: '2024-03-13' }, // Wednesday
      end:   { date: '2024-03-14' },
    };
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[allDayEvent]} />);
    
    const columns = document.querySelectorAll('.day-column');
    // Monday (11), Tuesday (12), Wednesday (13) -> index 2
    const wednesdayColumn = columns[2];
    expect(wednesdayColumn).toHaveTextContent('Family Holiday');
    
    // Verify it's NOT in Tuesday (index 1) which was the bug
    const tuesdayColumn = columns[1];
    expect(tuesdayColumn).not.toHaveTextContent('Family Holiday');
  });

  it('ignores events that fall outside the current week', () => {
    const outOfWeekEvent = makeEvent({
      id: 'next-week',
      summary: 'Next Week Event',
      start: { dateTime: '2024-03-20T09:00:00Z' }, // following Wednesday
      end:   { dateTime: '2024-03-20T10:00:00Z' },
    });
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[outOfWeekEvent]} />);
    expect(screen.queryByText('Next Week Event')).not.toBeInTheDocument();
  });

  it('places a multiday all-day event on multiple days', () => {
    const multiDayEvent = {
      id: 'multiday-all-day',
      summary: 'Long Trip',
      start: { date: '2024-03-13' }, // Wed
      end:   { date: '2024-03-16' }, // Ends Sat (exclusive), so Wed, Thu, Fri
    };
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[multiDayEvent]} />);
    
    const columns = document.querySelectorAll('.day-column');
    expect(columns[2]).toHaveTextContent('Long Trip'); // Wed
    expect(columns[3]).toHaveTextContent('Long Trip'); // Thu
    expect(columns[4]).toHaveTextContent('Long Trip'); // Fri
    expect(columns[5]).not.toHaveTextContent('Long Trip'); // Sat (exclusive)
  });

  it('places a timed event spanning midnight on both days', () => {
    // Create an event that starts today at 10 PM and ends tomorrow at 2 AM local time
    const today = new Date(FIXED_WEDNESDAY);
    const tomorrow = new Date(FIXED_WEDNESDAY);
    tomorrow.setDate(today.getDate() + 1);

    const start = new Date(today);
    start.setHours(22, 0, 0, 0);
    const end = new Date(tomorrow);
    end.setHours(2, 0, 0, 0);

    const overnightEvent = {
      id: 'overnight',
      summary: 'Late Party',
      start: { dateTime: start.toISOString() },
      end:   { dateTime: end.toISOString() },
    };
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[overnightEvent]} />);

    const columns = document.querySelectorAll('.day-column');
    // We expect it on Wed (index 2) and Thu (index 3)
    expect(columns[2]).toHaveTextContent('Late Party');
    expect(columns[3]).toHaveTextContent('Late Party');
  });

  it('correctly calculates the week when the current day is Sunday', () => {
    // Sun 17 Mar 2024 — the week should still start on Mon 11 Mar
    const sunday = new Date('2024-03-17T12:00:00Z');
    render(<WeekGrid currentDate={sunday} events={[]} />);
    const dayNames = document.querySelectorAll('.day-name');
    expect(dayNames[0].textContent).toMatch(/^Mon/i);
    expect(dayNames[6].textContent).toMatch(/^Sun/i);
  });
});
