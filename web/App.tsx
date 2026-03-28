import { useState, useEffect, useRef } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import CalendarHeader from './components/CalendarHeader';
import WeekGrid from './components/WeekGrid';
import SettingsModal from './components/SettingsModal';
import PresentationControls from './components/PresentationControls';
import { usePresentationMode } from './hooks/usePresentationMode';
import { CalendarProvider, useCalendarContext } from './context/CalendarContext';
import { exchangeCode, resetSettings, checkAuthStatus } from './services/backend';
import { filterHiddenAttendees } from './utils/annotateEnrichment';
import { GoogleCalendarEvent } from 'common/types';

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

interface AppContentProps {
  sessionToken: string | null;
  hasRefreshToken: boolean;
  errorMSG: string | null;
  setErrorMSG: (msg: string | null) => void;
  login: () => void;
  logout: () => void;
  handleFullReset: () => void;
}

function AppContent({ sessionToken, hasRefreshToken, errorMSG, setErrorMSG, login, logout, handleFullReset }: AppContentProps) {
  const [view, setView] = useState<ViewType>(VIEWS.MAIN);
  const [settingsTab, setSettingsTab] = useState<string>('calendars');

  const {
    currentDate,
    events,
    peopleDB,
    loading,
    errorMSG: dataError,
    isNewUser
  } = useCalendarContext();

  // Dynamic View Helper
  const isView = (target: ViewType) => view === target;

  // Refs for keyboard navigation mapping
  const prevWeekRef = useRef<HTMLButtonElement | null>(null);
  const nextWeekRef = useRef<HTMLButtonElement | null>(null);
  const presentBtnRef = useRef<HTMLButtonElement | null>(null);
  const helpBtnRef = useRef<HTMLButtonElement | null>(null);
  const presentationPrevRef = useRef<HTMLButtonElement | null>(null);
  const presentationNextRef = useRef<HTMLButtonElement | null>(null);

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
  }, [dataError, setErrorMSG]);

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
  }, [view]);

  return (
    <>
      <div className="app-container glass">
        <header className="app-header">
          <h1>Family <span className="highlight-text">Calendar</span></h1>

          {sessionToken && !isView(VIEWS.PRESENTATION) && (
            <CalendarHeader
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

            {(!sessionToken || !hasRefreshToken) && (
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

                // Same day: all-day events first
                const isAllDayA = !!a.start.date;
                const isAllDayB = !!b.start.date;
                if (isAllDayA !== isAllDayB) {
                  return isAllDayA ? -1 : 1;
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

function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(localStorage.getItem('session_token') || null);
  const [hasRefreshToken, setHasRefreshToken] = useState<boolean>(true); 
  const [errorMSG, setErrorMSG] = useState<string | null>(null);

  // Bootstrap session from Cloudflare or existing token
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const status = await checkAuthStatus(sessionToken);
        if (status.session_token) {
          setSessionToken(status.session_token);
          localStorage.setItem('session_token', status.session_token);
          setHasRefreshToken(status.hasRefreshToken);
          
          if (!status.hasRefreshToken) {
            setErrorMSG('Connected via Cloudflare, but Google Calendar access is not yet authorized. Please Sign In below.');
          }
        } else {
          setHasRefreshToken(false);
          setSessionToken(null);
          localStorage.removeItem('session_token');
        }
      } catch (e) {
        // Not authenticated via any method or session expired
        setHasRefreshToken(false);
      }
    };
    bootstrap();
  }, []);

  const login = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      try {
        const { session_token } = await exchangeCode(codeResponse.code);
        if (session_token) {
          setSessionToken(session_token);
          localStorage.setItem('session_token', session_token);
          setHasRefreshToken(true);
          setErrorMSG(null);
        }
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

  const handleFullReset = async () => {
    if (sessionToken) await resetSettings(sessionToken as string);
    
    // Preserve session token but clear other local data to simulate "first login"
    const token = localStorage.getItem('session_token');
    localStorage.clear();
    if (token) localStorage.setItem('session_token', token);
    
    window.location.reload();
  };

  return (
    <CalendarProvider sessionToken={sessionToken}>
      <AppContent 
        sessionToken={sessionToken}
        hasRefreshToken={hasRefreshToken}
        errorMSG={errorMSG}
        setErrorMSG={setErrorMSG}
        login={login}
        logout={logout}
        handleFullReset={handleFullReset}
      />
    </CalendarProvider>
  );
}

export default App;
