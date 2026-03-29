import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DayColumn from '../DayColumn';

vi.mock('../../context/CalendarContext', () => ({
  useCalendarContext: () => ({
    isEventEditMode: false,
    toggleHiddenEvent: vi.fn(),
  }),
}));
import { GoogleCalendarEvent } from 'common/types';

describe('DayColumn', () => {
    const mockDate = new Date('2024-03-13T12:00:00Z'); // Wed 13 Mar 2024

    it('renders all-day events before timed events', () => {
        const events: GoogleCalendarEvent[] = [
            {
                id: 'timed-1',
                summary: 'Timed Event (Later)',
                start: { dateTime: '2024-03-13T15:00:00Z' },
                end: { dateTime: '2024-03-13T16:00:00Z' }
            },
            {
                id: 'allday-1',
                summary: 'All-Day Event',
                start: { date: '2024-03-13' },
                end: { date: '2024-03-14' }
            },
            {
                id: 'timed-2',
                summary: 'Timed Event (Earlier)',
                start: { dateTime: '2024-03-13T09:00:00Z' },
                end: { dateTime: '2024-03-13T10:00:00Z' }
            }
        ];

        render(<DayColumn date={mockDate} events={events} isToday={false} />);

        const eventTitles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
        
        // Assert All-Day is first
        expect(eventTitles[0]).toBe('All-Day Event');
        // Then timed events in order
        expect(eventTitles[1]).toBe('Timed Event (Earlier)');
        expect(eventTitles[2]).toBe('Timed Event (Later)');
    });
});
