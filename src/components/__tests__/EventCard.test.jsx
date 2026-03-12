import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import EventCard from '../EventCard';

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
    render(<EventCard event={makeEvent({ summary: 'Sprint Planning' })} />);
    expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
  });

  it('shows "Untitled Event" when summary is missing', () => {
    render(<EventCard event={makeEvent({ summary: undefined })} />);
    expect(screen.getByText('Untitled Event')).toBeInTheDocument();
  });

  // ── Time display ──────────────────────────────────────────────────────────

  it('shows "All Day" when the event has no start.dateTime', () => {
    const allDayEvent = makeEvent({
      start: { date: '2024-03-13' },
      end:   { date: '2024-03-14' },
    });
    delete allDayEvent.start.dateTime;
    delete allDayEvent.end.dateTime;

    render(<EventCard event={allDayEvent} />);
    expect(screen.getByText('All Day')).toBeInTheDocument();
  });

  // ── Attendees ─────────────────────────────────────────────────────────────

  it('does not render the attendee row when there are no attendees', () => {
    render(<EventCard event={makeEvent({ attendees: [] })} />);
    expect(document.querySelector('.event-attendees')).toBeNull();
  });

  it('renders one avatar per attendee (up to 6)', () => {
    const attendees = [1, 2, 3].map(n => ({
      email: `person${n}@example.com`,
      displayName: `Person ${n}`,
    }));
    render(<EventCard event={makeEvent({ attendees })} />);
    const avatars = document.querySelectorAll('.attendee-avatar');
    expect(avatars).toHaveLength(3);
  });

  it('shows an overflow badge (+N) when there are more than 6 attendees', () => {
    const attendees = Array.from({ length: 8 }, (_, i) => ({
      email: `person${i}@example.com`,
      displayName: `Person ${i}`,
    }));
    render(<EventCard event={makeEvent({ attendees })} />);
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
    render(<EventCard event={makeEvent({ attendees })} />);
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
    render(<EventCard event={makeEvent({ attendees })} />);

    const border = document.querySelector('.event-card-border');
    expect(border.style.background).toContain('linear-gradient');
  });
});
