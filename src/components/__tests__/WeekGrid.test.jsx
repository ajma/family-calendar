import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WeekGrid from '../WeekGrid';

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

  it('shows "No events" in columns that have no events', () => {
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[]} />);
    const emptyMessages = screen.getAllByText('No events');
    expect(emptyMessages).toHaveLength(7);
  });

  it('does not show "No events" in a column that has an event', () => {
    const event = makeEvent({ summary: 'Wednesday Meeting' });
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[event]} />);
    // 6 empty days + 1 day that has an event (not "No events")
    const emptyMessages = screen.getAllByText('No events');
    expect(emptyMessages).toHaveLength(6);
  });

  it('places an all-day event (start.date only) on the correct day', () => {
    const allDayEvent = {
      id: 'all-day-evt',
      summary: 'Family Holiday',
      start: { date: '2024-03-13' },
      end:   { date: '2024-03-14' },
    };
    render(<WeekGrid currentDate={FIXED_WEDNESDAY} events={[allDayEvent]} />);
    expect(screen.getByText('Family Holiday')).toBeInTheDocument();
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

  it('correctly calculates the week when the current day is Sunday', () => {
    // Sun 17 Mar 2024 — the week should still start on Mon 11 Mar
    const sunday = new Date('2024-03-17T12:00:00Z');
    render(<WeekGrid currentDate={sunday} events={[]} />);
    const dayNames = document.querySelectorAll('.day-name');
    expect(dayNames[0].textContent).toMatch(/^Mon/i);
    expect(dayNames[6].textContent).toMatch(/^Sun/i);
  });
});
