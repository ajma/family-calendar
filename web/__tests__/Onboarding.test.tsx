import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from '../App';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Mock the backend services
vi.mock('../services/backend', () => ({
    exchangeCode: vi.fn(),
    resetSettings: vi.fn(),
    saveSettings: vi.fn(),
    fetchSettings: vi.fn(),
    fetchCalendars: vi.fn(),
    fetchEvents: vi.fn(),
}));

// Mock the CalendarContext hook
const mockUseCalendarData = vi.fn();
vi.mock('../context/CalendarContext', () => ({
    CalendarProvider: ({ children }: any) => <>{children}</>,
    useCalendarContext: () => mockUseCalendarData()
}));

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <GoogleOAuthProvider clientId="fake-id">
        {children}
    </GoogleOAuthProvider>
);

describe('Onboarding Flow', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        localStorage.clear();
    });

    afterEach(() => {
        cleanup();
    });

    it('automatically opens the User Guide on first-time login', async () => {
        // Setup mock for new user
        mockUseCalendarData.mockReturnValue({
            currentDate: new Date(),
            events: [],
            calendars: [],
            calendarConfigs: {},
            peopleDB: [],
            loading: false,
            errorMSG: null,
            isAdmin: false,
            userEmail: 'newuser@example.com',
            handlePrevWeek: vi.fn(),
            handleNextWeek: vi.fn(),
            handleToday: vi.fn(),
            loadEvents: vi.fn(),
            handleSaveAttendees: vi.fn(),
            handleSaveCalendars: vi.fn(),
            persistSettings: vi.fn(),
            isNewUser: true // TRIGGER
        });

        localStorage.setItem('session_token', 'fake-token');
        render(<App />, { wrapper: Wrapper });

        // Verify Settings Modal is open and shows User Guide
        // SettingsModal has a title "User Guide"
        const guideTitle = await screen.findByText("User Guide", { selector: '.settings-section-title' });
        expect(guideTitle).toBeInTheDocument();
        
        // Specifically look for the guide content to be sure it's the guide tab
        expect(screen.getByText(/Keyboard Shortcuts/i)).toBeInTheDocument();
    });

    it('does NOT automatically open the Settings modal for existing users', async () => {
        // Setup mock for existing user
        mockUseCalendarData.mockReturnValue({
            currentDate: new Date(),
            events: [],
            calendars: [],
            calendarConfigs: { 'cal-1': { selected: true } },
            peopleDB: [{ email: 'test@example.com', name: 'Test' }],
            loading: false,
            errorMSG: null,
            isAdmin: false,
            userEmail: 'existing@example.com',
            handlePrevWeek: vi.fn(),
            handleNextWeek: vi.fn(),
            handleToday: vi.fn(),
            loadEvents: vi.fn(),
            handleSaveAttendees: vi.fn(),
            handleSaveCalendars: vi.fn(),
            persistSettings: vi.fn(),
            isNewUser: false // NO TRIGGER
        });

        localStorage.setItem('session_token', 'fake-token');
        render(<App />, { wrapper: Wrapper });

        // Verify Settings Modal is NOT open
        expect(screen.queryByText(/User Guide/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Family/i)).toBeInTheDocument(); // Main view content
    });
});
