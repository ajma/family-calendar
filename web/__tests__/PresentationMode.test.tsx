import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

// Mock Google Login
vi.mock('@react-oauth/google', () => ({
    useGoogleLogin: vi.fn(),
    googleLogout: vi.fn(),
    GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock backend services
vi.mock('../services/backend', () => ({
    fetchSettings: vi.fn().mockResolvedValue({
        calendarConfigs: {
            'cal1': { selected: true, emoji: '📅' }
        },
        people: [
            { email: 'user@example.com', name: 'User', show: true }
        ]
    }),
    saveSettings: vi.fn(),
    resetSettings: vi.fn(),
    exchangeCode: vi.fn(),
    fetchCalendars: vi.fn().mockResolvedValue([{ id: 'cal1', primary: true, summary: 'Primary' }]),
    fetchEvents: vi.fn().mockResolvedValue([
        { 
            id: '1', 
            summary: 'Event 1', 
            start: { dateTime: '2026-03-13T10:00:00Z' }, 
            end: { dateTime: '2026-03-13T11:00:00Z' } 
        },
        { 
            id: '2', 
            summary: 'Event 2', 
            start: { dateTime: '2026-03-13T12:00:00Z' }, 
            end: { dateTime: '2026-03-13T13:00:00Z' } 
        }
    ]),
}));

describe('Presentation Mode', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('toggles presentation mode and reveals events sequentially', async () => {
        localStorage.setItem('session_token', 'fake-token');
        
        await act(async () => {
            render(<App />);
        });

        // 1. Enter Presentation Mode
        const presentBtn = await screen.findByText(/Present/i);
        await act(async () => {
            fireEvent.click(presentBtn);
        });

        // 2. Verify header is simplified (other buttons hidden)
        expect(screen.queryByText(/Settings/i)).not.toBeInTheDocument();

        // 3. Verify no events are shown initially
        expect(screen.queryByText('Event 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Event 2')).not.toBeInTheDocument();

        // 4. Click Next to reveal first event
        const nextBtn = screen.getByTitle(/Next/i);
        await act(async () => {
            fireEvent.click(nextBtn);
        });
        expect(screen.getByText('Event 1')).toBeInTheDocument();
        expect(screen.queryByText('Event 2')).not.toBeInTheDocument();

        // 5. Click Next to reveal second event
        await act(async () => {
            fireEvent.click(nextBtn);
        });
        expect(screen.getByText('Event 1')).toBeInTheDocument();
        expect(screen.getByText('Event 2')).toBeInTheDocument();

        // 6. Click Prev to hide one event
        const prevBtn = screen.getByTitle(/Previous/i);
        await act(async () => {
            fireEvent.click(prevBtn);
        });
        expect(screen.getByText('Event 1')).toBeInTheDocument();
        expect(screen.queryByText('Event 2')).not.toBeInTheDocument();

        // 7. Test Keyboard Shortcut (Right Arrow)
        await act(async () => {
            fireEvent.keyDown(window, { key: 'ArrowRight' });
        });
        expect(screen.getByText('Event 2')).toBeInTheDocument();

        // 8. Exit Presentation Mode
        const endBtn = screen.getByRole('button', { name: /End/i });
        await act(async () => {
            fireEvent.click(endBtn);
        });

        // Wait for state transition back to normal
        await waitFor(() => {
            expect(screen.getByText(/Present/i)).toBeInTheDocument();
        });
        
        // Ensure header elements reappear
        expect(await screen.findByText(/Settings/i)).toBeInTheDocument();
    });

    it('reveals timed events before all-day events on the same day', async () => {
        const { fetchEvents } = await import('../services/backend');
        vi.mocked(fetchEvents).mockResolvedValue([
            { 
                id: 'allday', 
                summary: 'All Day Event', 
                start: { date: '2026-03-13' }, 
                end: { date: '2026-03-14' } 
            },
            { 
                id: 'timed', 
                summary: 'Timed Event', 
                start: { dateTime: '2026-03-13T20:00:00Z' }, 
                end: { dateTime: '2026-03-13T21:00:00Z' } 
            }
        ]);

        localStorage.setItem('session_token', 'fake-token');
        await act(async () => {
            render(<App />);
        });

        // 1. Enter Presentation Mode
        const presentBtn = await screen.findByText(/Present/i);
        await act(async () => {
            fireEvent.click(presentBtn);
        });

        const nextBtn = screen.getByTitle(/Next/i);

        // 2. First click should reveal Timed Event (priority)
        await act(async () => {
            fireEvent.click(nextBtn);
        });
        expect(await screen.findByText('Timed Event')).toBeInTheDocument();
        expect(screen.queryByText('All Day Event')).not.toBeInTheDocument();

        // 3. Second click should reveal All Day Event
        await act(async () => {
            fireEvent.click(nextBtn);
        });
        expect(screen.getByText('Timed Event')).toBeInTheDocument();
        expect(await screen.findByText('All Day Event')).toBeInTheDocument();
    });
});
