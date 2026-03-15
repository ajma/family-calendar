import { useState, useEffect, useRef } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import CalendarHeader from './components/CalendarHeader';
import WeekGrid from './components/WeekGrid';
import SettingsModal from './components/SettingsModal';
import PresentationControls from './components/PresentationControls';
import { usePresentationMode } from './hooks/usePresentationMode';
import { useCalendarData } from './hooks/useCalendarData';
import { exchangeCode, resetSettings } from './services/backend';
import { filterHiddenAttendees } from './utils/annotateEnrichment';
import { GoogleCalendarEvent, GoogleCalendar, CalendarConfig, Person } from 'common/types';

// Modular Styles
import './index.css';
import './styles/layout.css';
import './styles/grid.css';
import './styles/components.css';
import './styles/presentation.css';
import './styles/print.css';

const VIEWS = {
  MAIN: 'main',
  SETTINGS: 'settings',
  PRESENTATION: 'presentation',
  HELP: 'help'
} as const;

type ViewType = typeof VIEWS[keyof typeof VIEWS];

function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(localStorage.getItem('session_token') || null);
  const [errorMSG, setErrorMSG] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>(VIEWS.MAIN);
  const [settingsTab, setSettingsTab] = useState<string>('calendars');

  // Dynamic View Helper
  const isView = (target: ViewType) => view === target;

  // Refs for keyboard navigation mapping
  const prevWeekRef = useRef<HTMLButtonElement | null>(null);
  const nextWeekRef = useRef<HTMLButtonElement | null>(null);
  const presentBtnRef = useRef<HTMLButtonElement | null>(null);
  const helpBtnRef = useRef<HTMLButtonElement | null>(null);
  const presentationPrevRef = useRef<HTMLButtonElement | null>(null);
  const presentationNextRef = useRef<HTMLButtonElement | null>(null);

  // Core Data Logic Hook
  const {
    currentDate,
    events,
    calendars,
    calendarConfigs,
    peopleDB,
    loading,
    errorMSG: dataError,
    isAdmin,
    userEmail,
    handlePrevWeek,
    handleNextWeek,
    handleToday,
    loadEvents,
    handleSaveAttendees,
    handleSaveCalendars,
    persistSettings,
    isNewUser
  }: {
    currentDate: Date;
    events: GoogleCalendarEvent[];
    calendars: GoogleCalendar[];
    calendarConfigs: Record<string, CalendarConfig>;
    peopleDB: Person[];
    loading: boolean;
    errorMSG: string | null;
    isAdmin: boolean;
    userEmail: string;
    handlePrevWeek: () => void;
    handleNextWeek: () => void;
    handleToday: () => void;
    loadEvents: (configs?: Record<string, CalendarConfig>, people?: Person[]) => Promise<void>;
    handleSaveAttendees: (people: Person[]) => Promise<void>;
    handleSaveCalendars: (configs: Record<string, CalendarConfig>) => Promise<void>;
    persistSettings: (configs: Record<string, CalendarConfig>, people: Person[]) => Promise<void>;
    isNewUser: boolean;
  } = useCalendarData(sessionToken);

  // Presentation Mode Logic Hook
  const {
    revealedCount,
    nextEvent,
    prevEvent
  } = usePresentationMode(isView(VIEWS.PRESENTATION));

  const togglePresentationMode = () => {
    setView(prev => prev === VIEWS.PRESENTATION ? VIEWS.MAIN : VIEWS.PRESENTATION);
  };

  // Sync data errors to main error state
  useEffect(() => {
    if (dataError) setErrorMSG(dataError);
  }, [dataError]);

  const login = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      try {
        const { session_token } = await exchangeCode(codeResponse.code);
        setSessionToken(session_token);
        localStorage.setItem('session_token', session_token);
        setErrorMSG(null);
      } catch (e) {
        console.error('Token exchange failed', e);
        setErrorMSG('Login failed. Please try again.');
      }
    },
    onError: (error) => {
      console.error('Login Failed', error);
      setErrorMSG('Login failed. Please try again.');
    },
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  });

  const logout = () => {
    googleLogout();
    setSessionToken(null);
    localStorage.clear();
    window.location.reload(); // Hard reset for clean state
  };

  // Sync session expiry
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      setErrorMSG('Your session expired. Please sign in again.');
    };
    window.addEventListener('api-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('api-unauthorized', handleUnauthorized);
  }, []);

  // First-time Onboarding Auto-popup
  useEffect(() => {
    if (isNewUser) {
      setSettingsTab('guide');
      setView(VIEWS.SETTINGS);
    }
  }, [isNewUser]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Inhibition Logic
      const target = e.target as HTMLElement;
      const tagName = target.tagName ? target.tagName.toUpperCase() : '';
      const isTyping = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable;
      if (isTyping) return;

      if (isView(VIEWS.PRESENTATION)) {
        // Presentation Mode Shortcuts
        if (e.key === 'ArrowRight' || e.key === ' ') {
          if (e.key === ' ') e.preventDefault();
          presentationNextRef.current?.click();
        } else if (e.key === 'ArrowLeft') {
          presentationPrevRef.current?.click();
        } else if (e.key === 'Escape') {
          presentBtnRef.current?.click();
        }
      } else if (isView(VIEWS.MAIN)) {
        // Main View Shortcuts
        if (e.key === 'ArrowLeft') {
          prevWeekRef.current?.click();
        } else if (e.key === 'ArrowRight') {
          nextWeekRef.current?.click();
        } else if (e.key === ' ') {
          e.preventDefault();
          presentBtnRef.current?.click();
        } else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
          setSettingsTab('guide');
          setView(VIEWS.SETTINGS);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view]); // Depend on view to re-bind with correct helper results

  const handleFullReset = async () => {
    if (sessionToken) await resetSettings(sessionToken);
    setView(VIEWS.MAIN);
    logout();
  };

  const handleSettingsSave = async (newConfigs: CalendarConfig[], newPeople: Person[]) => {
    // Convert array to record for handleSaveCalendars
    const configRecord: Record<string, CalendarConfig> = {};
    newConfigs.forEach(c => { 
      if (c.id) {
        const { summary, primary, ...rest } = c as any;
        configRecord[c.id] = rest as CalendarConfig;
      } 
    });
    
    await persistSettings(configRecord, newPeople);
    await loadEvents(configRecord, newPeople);
    setView(VIEWS.MAIN);
  };

  return (
    <>
      <div className="app-container glass">
        <header className="app-header">
          <h1>Family <span className="highlight-text">Calendar</span></h1>

          {sessionToken && !isView(VIEWS.PRESENTATION) && (
            <CalendarHeader
              currentDate={currentDate}
              onPrev={handlePrevWeek}
              onNext={handleNextWeek}
              onToday={handleToday}
              onRefresh={loadEvents}
              prevRef={prevWeekRef}
              nextRef={nextWeekRef}
            />
          )}

          <div className="auth-controls" style={{ display: 'flex', alignItems: 'center' }}>
            {sessionToken && isView(VIEWS.MAIN) && (
              <button 
                className="control-btn glass" 
                style={{ marginRight: '1rem' }} 
                onClick={() => { setSettingsTab('calendars'); setView(VIEWS.SETTINGS); }}
                title="Settings"
              >
                ⚙️ Settings
              </button>
            )}



            {sessionToken && (
              <button 
                ref={presentBtnRef}
                className={`control-btn glass ${isView(VIEWS.PRESENTATION) ? 'active-mode' : ''}`} 
                style={{ marginRight: '1rem' }} 
                onClick={togglePresentationMode}
              >
                {isView(VIEWS.PRESENTATION) ? '⏹ End' : '▶ Present'}
              </button>
            )}

            {!sessionToken && (
              <button className="control-btn" style={{ background: 'var(--accent-blue)', color: 'white', border: 'none' }} onClick={() => login()}>Sign In with Google</button>
            )}
          </div>
        </header>

        <main className="app-main">
          {errorMSG && (
            <div className="error-message" style={{ color: '#ff7b72', textAlign: 'center', marginBottom: '1rem', background: 'rgba(255,123,114,0.1)', padding: '1rem', borderRadius: '8px' }}>
              {errorMSG}
            </div>
          )}

          {!sessionToken ? (
            <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
              Please sign in to view your calendar events.
            </div>
          ) : loading ? (
            <div className="loading-state glass" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading your schedule...</div>
          ) : (() => {
            let filteredEvents = filterHiddenAttendees(events, peopleDB);
            
            if (isView(VIEWS.PRESENTATION)) {
              filteredEvents = [...filteredEvents].sort((a, b) => {
                const getLocalDateStr = (event: GoogleCalendarEvent) => {
                  if (event.start.date) return event.start.date;
                  const d = new Date(event.start.dateTime!);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                };

                const dayA = getLocalDateStr(a);
                const dayB = getLocalDateStr(b);

                if (dayA !== dayB) {
                  return dayA.localeCompare(dayB);
                }

                // Same day: Timed events first, then all-day
                const isAllDayA = !a.start.dateTime;
                const isAllDayB = !b.start.dateTime;
                if (isAllDayA !== isAllDayB) {
                  return isAllDayA ? 1 : -1;
                }

                // Tie-breaker: chronological order
                const dateA = new Date(a.start.dateTime || a.start.date!).getTime();
                const dateB = new Date(b.start.dateTime || b.start.date!).getTime();
                return dateA - dateB;
              });
              filteredEvents = filteredEvents.slice(0, revealedCount);
            }

            return <WeekGrid currentDate={currentDate} events={filteredEvents as GoogleCalendarEvent[]} />;
          })()}
        </main>

        {isView(VIEWS.PRESENTATION) && (
          <PresentationControls 
            revealedCount={revealedCount}
            onPrev={prevEvent}
            onNext={nextEvent}
            prevRef={presentationPrevRef}
            nextRef={presentationNextRef}
          />
        )}

        {sessionToken && (
          <SettingsModal
            isOpen={isView(VIEWS.SETTINGS)}
            onClose={() => setView(VIEWS.MAIN)}
            calendars={calendars}
            calendarConfigs={calendarConfigs}
            people={peopleDB}
            userEmail={userEmail}
            isAdmin={isAdmin}
            onSave={handleSettingsSave}
            onLogout={logout}
            onFullReset={handleFullReset}
            initialTab={settingsTab}
          />
        )}
      </div>
      <footer className="version-label">
        v{import.meta.env.PACKAGE_VERSION}
      </footer>
    </>
  );
}

export default App;
