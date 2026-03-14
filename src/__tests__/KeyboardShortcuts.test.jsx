import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from '../App';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Mock the backend services
vi.mock('../services/backend', () => ({
    exchangeCode: vi.fn(),
    resetSettings: vi.fn(),
    saveSettings: vi.fn(),
}));

// Mock the hooks to avoid actual data fetching
vi.mock('../hooks/useCalendarData', () => ({
    useCalendarData: () => ({
        currentDate: new Date('2026-03-09T12:00:00Z'),
        events: [],
        calendars: [],
        calendarConfigs: {},
        peopleDB: [{ email: 'test@example.com', name: 'Test Person', initials: 'TP', color: '#ff0000', show: true }],
        loading: false,
        errorMSG: null,
        isAdmin: true,
        userEmail: 'test@example.com',
        handlePrevWeek: vi.fn(),
        handleNextWeek: vi.fn(),
        handleToday: vi.fn(),
        loadEvents: vi.fn(),
        handleSaveAttendees: vi.fn(),
        handleSaveCalendars: vi.fn(),
    })
}));

const Wrapper = ({ children }) => (
    <GoogleOAuthProvider clientId="fake-id">
        {children}
    </GoogleOAuthProvider>
);

describe('Keyboard Shortcuts (Button Mapped)', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        localStorage.clear();
        // Reset window state
        window.history.pushState({}, '', '/');
    });

    afterEach(() => {
        cleanup();
    });

    it('navigates weeks using arrow keys in main view', async () => {
        localStorage.setItem('session_token', 'fake-token');
        render(<App />, { wrapper: Wrapper });

        const prevBtn = await screen.findByRole('button', { name: /Previous Week/i });
        const nextBtn = await screen.findByRole('button', { name: /Next Week/i });

        const prevSpy = vi.spyOn(prevBtn, 'click');
        const nextSpy = vi.spyOn(nextBtn, 'click');

        // Press ArrowRight
        fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' });
        expect(nextSpy).toHaveBeenCalled();

        // Press ArrowLeft
        fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft' });
        expect(prevSpy).toHaveBeenCalled();
    });

    it('toggles presentation mode with spacebar', async () => {
        localStorage.setItem('session_token', 'fake-token');
        render(<App />, { wrapper: Wrapper });

        const presentBtn = await screen.findByRole('button', { name: /Present/i });
        const presentSpy = vi.spyOn(presentBtn, 'click');

        // Press Space
        fireEvent.keyDown(window, { key: ' ', code: 'Space' });
        expect(presentSpy).toHaveBeenCalled();
    });

    it('inhibits shortcuts when typing in inputs', async () => {
        localStorage.setItem('session_token', 'fake-token');
        render(<App />, { wrapper: Wrapper });

        // Open settings to get an input
        const settingsBtn = await screen.findByTitle('Settings');
        fireEvent.click(settingsBtn);

        const attendeesTab = await screen.findByRole('button', { name: /Attendees/i });
        fireEvent.click(attendeesTab);

        // Find an input (e.g., person name input)
        const input = await screen.findByPlaceholderText(/Name/i);

        // Focus input
        input.focus();
        expect(document.activeElement).toBe(input);

        const presentBtn = screen.getByRole('button', { name: /Present/i });
        const presentSpy = vi.spyOn(presentBtn, 'click');

        // Press Space while typing
        fireEvent.keyDown(input, { key: ' ', code: 'Space', bubbles: true });
        
        // Should NOT have triggered presentation mode
        expect(presentSpy).not.toHaveBeenCalled();
    });

    it('navigates events in presentation mode using keys', async () => {
        localStorage.setItem('session_token', 'fake-token');
        render(<App />, { wrapper: Wrapper });

        // Enter presentation mode
        const presentBtn = await screen.findByRole('button', { name: /Present/i });
        fireEvent.click(presentBtn);

        // Wait for controls to appear
        const nextBtn = await screen.findByTitle(/Next/i);
        const prevBtn = await screen.findByTitle(/Previous/i);
        
        // The present button becomes the end button
        const endBtn = await screen.findByRole('button', { name: /End/i });

        const nextSpy = vi.spyOn(nextBtn, 'click');
        const prevSpy = vi.spyOn(prevBtn, 'click');
        const endSpy = vi.spyOn(endBtn, 'click');

        // Press ArrowRight
        fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' });
        expect(nextSpy).toHaveBeenCalled();

        // Press ArrowLeft
        fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft' });
        expect(prevSpy).toHaveBeenCalled();

        // Press Space
        fireEvent.keyDown(window, { key: ' ', code: 'Space' });
        expect(nextSpy).toHaveBeenCalledTimes(2);

        // Press Escape
        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
        expect(endSpy).toHaveBeenCalled();
    });
});
