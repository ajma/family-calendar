import { useState, useEffect } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import CalendarHeader from './components/CalendarHeader';
import WeekGrid from './components/WeekGrid';
import AttendeeEditor from './components/AttendeeEditor';
import CalendarSelectorModal from './components/CalendarSelectorModal';
import DebugModal from './components/DebugModal';
import PresentationControls from './components/PresentationControls';
import { usePresentationMode } from './hooks/usePresentationMode';
import { useCalendarData } from './hooks/useCalendarData';
import { exchangeCode, resetSettings, saveSettings } from './services/backend';
import { filterHiddenAttendees } from './utils/annotateEnrichment';

// Modular Styles
import './index.css';
import './styles/layout.css';
import './styles/grid.css';
import './styles/components.css';
import './styles/presentation.css';
import './styles/print.css';

function App() {
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('session_token') || null);
  const [errorMSG, setErrorMSG] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCalendarSelectorOpen, setIsCalendarSelectorOpen] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);

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
    handlePrevWeek,
    handleNextWeek,
    handleToday,
    loadEvents,
    handleSaveAttendees,
    handleSaveCalendars
  } = useCalendarData(sessionToken);

  // Presentation Mode Logic Hook
  const {
    presentationMode,
    revealedCount,
    togglePresentationMode,
    nextEvent,
    prevEvent
  } = usePresentationMode();

  // Sync data errors to main error state
  useEffect(() => {
    if (dataError) setErrorMSG(dataError);
  }, [dataError]);

  // Check for debug mode in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') setIsDebugMode(true);
  }, []);

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

  const handleFullReset = async () => {
    if (sessionToken) await resetSettings(sessionToken);
    setIsDebugModalOpen(false);
    logout();
  };

  return (
    <>
      <div className="app-container glass">
        <header className="app-header">
          <h1>Family <span className="highlight-text">Calendar</span></h1>

          {sessionToken && !presentationMode && (
            <CalendarHeader
              currentDate={currentDate}
              onPrev={handlePrevWeek}
              onNext={handleNextWeek}
              onToday={handleToday}
              onRefresh={loadEvents}
            />
          )}

          <div className="auth-controls" style={{ display: 'flex', alignItems: 'center' }}>
            {sessionToken && !presentationMode && (
              <>
                {calendars.length > 0 && (
                  <button className="control-btn glass" style={{ marginRight: '1rem' }} onClick={() => setIsCalendarSelectorOpen(true)}>📅 Calendars</button>
                )}
                <button className="control-btn glass" style={{ marginRight: '1rem' }} onClick={() => setIsEditorOpen(true)}>👥 Attendees</button>
              </>
            )}

            {sessionToken && (
              <button 
                className={`control-btn glass ${presentationMode ? 'active-mode' : ''}`} 
                style={{ marginRight: '1rem' }} 
                onClick={togglePresentationMode}
              >
                {presentationMode ? '⏹ End' : '▶ Present'}
              </button>
            )}

            {sessionToken && !presentationMode ? (
              <button className="control-btn glass" onClick={logout}>Sign Out</button>
            ) : !sessionToken && (
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
            
            if (presentationMode) {
              filteredEvents = [...filteredEvents].sort((a, b) => {
                const dateA = new Date(a.start.dateTime || a.start.date);
                const dateB = new Date(b.start.dateTime || b.start.date);
                return dateA - dateB;
              });
              filteredEvents = filteredEvents.slice(0, revealedCount);
            }

            return <WeekGrid currentDate={currentDate} events={filteredEvents} />;
          })()}
        </main>

        {presentationMode && (
          <PresentationControls 
            revealedCount={revealedCount}
            onPrev={prevEvent}
            onNext={nextEvent}
          />
        )}

        <AttendeeEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          people={peopleDB}
          onSave={handleSaveAttendees}
        />

        <CalendarSelectorModal
          isOpen={isCalendarSelectorOpen}
          onClose={() => setIsCalendarSelectorOpen(false)}
          calendars={calendars}
          calendarConfigs={calendarConfigs}
          people={peopleDB}
          onSave={handleSaveCalendars}
        />

        {isDebugMode && sessionToken && isAdmin && (
          <>
            <button
              onClick={() => setIsDebugModalOpen(true)}
              title="Open Debug Panel"
              className="debug-trigger"
              style={{
                position: 'fixed',
                bottom: '2rem',
                right: '2rem',
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                backgroundColor: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                cursor: 'pointer',
                zIndex: 999,
                transition: 'transform var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              🐛
            </button>

            <DebugModal
              isOpen={isDebugModalOpen}
              onClose={() => setIsDebugModalOpen(false)}
              onBackendSave={async (configs, people) => {
                if (sessionToken) await saveSettings(sessionToken, configs, people);
              }}
              onFullReset={handleFullReset}
            />
          </>
        )}
      </div>
      <footer className="version-label">
        v{import.meta.env.PACKAGE_VERSION}
      </footer>
    </>
  );
}

export default App;
