import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventCard from '../EventCard';

vi.mock('../../context/CalendarContext', () => ({
  useCalendarContext: () => ({
    isEventEditMode: false,
    toggleHiddenEvent: vi.fn(),
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeEvent = (overrides = {}) => ({
  id: 'evt-1',
  summary: 'Team Standup',
  start: { dateTime: '2024-03-13T09:00:00Z' },
  end:   { dateTime: '2024-03-13T09:30:00Z' },
  attendees: [],
  ...overrides,
});

beforeEach(() => {
  // AttendeeAvatar reads from localStorage; provide a clean state per test
  localStorage.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EventCard', () => {
  // ── Title ─────────────────────────────────────────────────────────────────

  it('renders the event summary', () => {
    render(<EventCard event={makeEvent({ summary: 'Sprint Planning' })} currentDay={new Date()} />);
    expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
  });

  it('shows "Untitled Event" when summary is missing', () => {
    render(<EventCard event={makeEvent({ summary: undefined })} currentDay={new Date()} />);
    expect(screen.getByText('Untitled Event')).toBeInTheDocument();
  });

  it('calculates a smaller font size for very long titles', () => {
    const longTitle = 'This is a very very very very very very long title that should trigger font shrinking';
    render(<EventCard event={makeEvent({ summary: longTitle })} currentDay={new Date()} />);
    const titleElement = screen.getByText(longTitle);
    const fontSize = titleElement.style.fontSize;
    expect(fontSize).not.toBe('0.9rem');
    expect(parseFloat(fontSize)).toBeLessThan(0.9);
  });

  // ── Time display ──────────────────────────────────────────────────────────

  it('shows "All Day" when the event has no start.dateTime', () => {
    const allDayEvent = makeEvent({
      start: { date: '2024-03-13' },
      end:   { date: '2024-03-14' },
    });
    (allDayEvent.start as any).dateTime = undefined;
    (allDayEvent.end as any).dateTime = undefined;

    render(<EventCard event={allDayEvent} currentDay={new Date()} />);
    expect(screen.getByText('All Day')).toBeInTheDocument();
  });

  describe('Multiday time display', () => {
    const wednesday = new Date('2024-03-13T12:00:00'); // Local Wed
    const thursday  = new Date('2024-03-14T12:00:00'); // Local Thu
    const friday    = new Date('2024-03-15T12:00:00'); // Local Fri

    const overnightEvent = makeEvent({
      start: { dateTime: '2024-03-13T22:00:00' }, // Wed 10 PM
      end:   { dateTime: '2024-03-14T02:00:00' }, // Thu 2 AM
    });

    it('shows full range for same-day event', () => {
      render(<EventCard event={makeEvent()} currentDay={wednesday} />);
      // 9:00 AM - 9:30 AM (exact format depends on locale, but check for range)
      const text = screen.getByText(/AM.*-.*AM/);
      expect(text).toBeInTheDocument();
      expect(text).not.toHaveTextContent('→');
    });

    it('shows start time with arrow on the first day of multiday event', () => {
      render(<EventCard event={overnightEvent} currentDay={wednesday} />);
      // Should show something like "10:00 PM →"
      expect(screen.getByText(/10:00 PM\s*→/)).toBeInTheDocument();
    });

    it('shows arrow and end time on the last day of multiday event', () => {
      render(<EventCard event={overnightEvent} currentDay={thursday} />);
      // Should show something like "→ 2:00 AM"
      expect(screen.getByText(/→\s*2:00 AM/)).toBeInTheDocument();
    });

    it('shows "All Day" for middle days of long multiday events', () => {
      const longEvent = makeEvent({
        start: { dateTime: '2024-03-13T10:00:00' }, // Wed
        end:   { dateTime: '2024-03-15T15:00:00' }, // Fri
      });
      // Thursday is a middle day
      render(<EventCard event={longEvent} currentDay={thursday} />);
      expect(screen.getByText('All Day')).toBeInTheDocument();
    });
  });

  // ── Attendees ─────────────────────────────────────────────────────────────

  it('does not render the attendee row when there are no attendees', () => {
    render(<EventCard event={makeEvent({ attendees: [] })} currentDay={new Date()} />);
    expect(document.querySelector('.event-attendees')).toBeNull();
  });

  it('renders one avatar per attendee (up to 6)', () => {
    const attendees = [1, 2, 3].map(n => ({
      email: `person${n}@example.com`,
      displayName: `Person ${n}`,
    }));
    render(<EventCard event={makeEvent({ attendees })} currentDay={new Date()} />);
    const avatars = document.querySelectorAll('.attendee-avatar');
    expect(avatars).toHaveLength(3);
  });

  it('shows an overflow badge (+N) when there are more than 6 attendees', () => {
    const attendees = Array.from({ length: 8 }, (_, i) => ({
      email: `person${i}@example.com`,
      displayName: `Person ${i}`,
    }));
    render(<EventCard event={makeEvent({ attendees })} currentDay={new Date()} />);
    // Only 6 avatars should be rendered
    expect(document.querySelectorAll('.attendee-avatar')).toHaveLength(6);
    // The overflow element should show +2
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('does not show an overflow badge for exactly 6 attendees', () => {
    const attendees = Array.from({ length: 6 }, (_, i) => ({
      email: `person${i}@example.com`,
      displayName: `Person ${i}`,
    }));
    render(<EventCard event={makeEvent({ attendees })} currentDay={new Date()} />);
    expect(document.querySelector('.attendee-overflow')).toBeNull();
  });

  // ── Border indicator ──────────────────────────────────────────────────────
  it('uses a gradient border when there are multiple attendees with different colors', () => {
    // Seed localStorage so getAttendeeColor returns distinct colors
    const people = [
      { email: 'a@example.com', color: '#ff0000' },
      { email: 'b@example.com', color: '#0000ff' },
    ];
    localStorage.setItem('people', JSON.stringify(people));

    const attendees = people.map(p => ({ email: p.email, displayName: p.email }));
    render(<EventCard event={makeEvent({ attendees })} currentDay={new Date()} />);

    const border = document.querySelector('.event-card-border');
    expect((border as HTMLElement).style.background).toContain('linear-gradient');
  });
});
