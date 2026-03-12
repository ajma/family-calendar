import { useState, useEffect } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import CalendarHeader from './components/CalendarHeader';
import WeekGrid from './components/WeekGrid';
import AttendeeEditor from './components/AttendeeEditor';
import CalendarSelectorModal from './components/CalendarSelectorModal';
import DebugModal from './components/DebugModal';
import { fetchEvents, fetchCalendars } from './services/googleCalendar';
import { fetchSettings, saveSettings, resetSettings, exchangeCode, refreshAccessToken } from './services/backend';
import { annotateEvents, filterHiddenAttendees } from './utils/annotateEnrichment';
import { AVATAR_ICON_COLORS } from './constants';
import './index.css';
import './styles/calendar.css';

function App() {
  const [currentDate, setCurrentDate] = useState(() => {
    const savedDate = localStorage.getItem('selected_date');
    return savedDate ? new Date(savedDate) : new Date();
  });
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);

  const [calendarConfigs, setCalendarConfigs] = useState(() => {
    try {
      const saved = localStorage.getItem('calendar_configs');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState(localStorage.getItem('oauth_token') || null);
  // Expiry is a Unix timestamp in ms (matches Google's expiry_date field)
  const [tokenExpiry, setTokenExpiry] = useState(() => {
    const saved = localStorage.getItem('oauth_expiry');
    return saved ? parseInt(saved, 10) : null;
  });
  const [errorMSG, setErrorMSG] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCalendarSelectorOpen, setIsCalendarSelectorOpen] = useState(false);
  const [peopleDB, setPeopleDB] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('people') || '[]');
    } catch {
      return [];
    }
  });
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      if (!accessToken) return;
      try {
        const settings = await fetchSettings(accessToken);
        setIsAdmin(!!settings.isAdmin);
        if (settings.calendarConfigs && Object.keys(settings.calendarConfigs).length > 0) {
          setCalendarConfigs(settings.calendarConfigs);
          localStorage.setItem('calendar_configs', JSON.stringify(settings.calendarConfigs));
        }
        if (settings.people && settings.people.length > 0) {
          setPeopleDB(settings.people);
          localStorage.setItem('people', JSON.stringify(settings.people));
        }
      } catch (e) {
        console.error('Failed to load settings from DB, falling back to local storage', e);
      }
    };
    loadUserData();
  }, [accessToken]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      setIsDebugMode(true);
    }
  }, []);

  const login = useGoogleLogin({
    // auth-code flow: the backend exchanges the code for tokens and stores
    // the refresh token, so the frontend never handles it directly.
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      try {
        const { access_token, expiry_date } = await exchangeCode(codeResponse.code);
        setAccessToken(access_token);
        setTokenExpiry(expiry_date);
        localStorage.setItem('oauth_token', access_token);
        localStorage.setItem('oauth_expiry', expiry_date.toString());
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
    setAccessToken(null);
    setTokenExpiry(null);
    setEvents([]);
    setCalendars([]);
    setCalendarConfigs({});
    setPeopleDB([]);
    setIsAdmin(false);
    setCurrentDate(new Date());
    localStorage.clear();
  };
  // Silent token refresh: fires ~5 minutes before the access token expires
  // so the user never hits the 1-hour wall mid-session.
  useEffect(() => {
    if (!accessToken || !tokenExpiry) return;

    const msUntilRefresh = tokenExpiry - Date.now() - 5 * 60 * 1000;

    const doRefresh = async () => {
      try {
        const { access_token, expiry_date } = await refreshAccessToken(accessToken);
        setAccessToken(access_token);
        setTokenExpiry(expiry_date);
        localStorage.setItem('oauth_token', access_token);
        localStorage.setItem('oauth_expiry', expiry_date.toString());
      } catch (e) {
        console.error('Silent token refresh failed, logging out:', e);
        logout();
        setErrorMSG('Your session expired. Please sign in again.');
      }
    };

    if (msUntilRefresh <= 0) {
      // Token is already close to / past expiry — refresh immediately
      doRefresh();
      return;
    }

    const timer = setTimeout(doRefresh, msUntilRefresh);
    return () => clearTimeout(timer);
  }, [accessToken, tokenExpiry]);

  // Centralised dual write-through: always keeps localStorage and the
  // backend in sync in one place instead of scattered across handlers.
  const persistSettings = async (configs, people) => {
    localStorage.setItem('calendar_configs', JSON.stringify(configs));
    localStorage.setItem('people', JSON.stringify(people));
    if (accessToken) {
      await saveSettings(accessToken, configs, people);
    }
  };

  const handleFullReset = async () => {
    if (accessToken) {
      await resetSettings(accessToken);
    }
    setIsDebugModalOpen(false);
    logout();
  };

  const loadCalendars = async () => {
    if (!accessToken) return;
    try {
      const data = await fetchCalendars(accessToken);
      setCalendars(data);

      const primaryCal = data.find(c => c.primary);
      if (primaryCal) {
        // Use functional update so `prev` reflects the latest committed state
        // at setter-call time — not the stale closure value. This is critical
        // because loadUserData (which populates calendarConfigs from the DB)
        // and loadCalendars (which hits the Google API) race against each other.
        // If loadUserData wins, prev will already have selections and we bail out.
        setCalendarConfigs(prev => {
          const hasSelections = Object.values(prev).some(config => config.selected);
          if (!hasSelections) {
            const newConfigs = {
              ...prev,
              [primaryCal.id]: { ...prev[primaryCal.id], selected: true }
            };
            persistSettings(newConfigs, peopleDB).catch(e => console.error(e));
            return newConfigs;
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Failed to load calendars', error);
    }
  };

  const loadEvents = async () => {
    if (!accessToken) return;

    setLoading(true);
    setErrorMSG(null);
    try {
      // Calculate start and end of week relative to currentDate
      const dayOfWeek = currentDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() + mondayOffset);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Extract hashtags for fetching
      const fetchHashtags = Object.entries(calendarConfigs).reduce((acc, [calId, config]) => {
        if (config.hashtag) acc[calId] = config.hashtag;
        return acc;
      }, {});

      // Extract selected calendars for fetching
      const selectedCalendars = Object.entries(calendarConfigs)
        .filter(([_, config]) => config.selected)
        .map(([calId, _]) => calId);

      let eventsData = await fetchEvents(accessToken, selectedCalendars, startOfWeek.toISOString(), endOfWeek.toISOString(), fetchHashtags);

      // Use peopleDB state directly — avoids stale reads from localStorage
      const existingPeople = peopleDB;

      // Annotate events with emoji prefixes, auto-assigned attendees, and #allfamily expansion
      eventsData = annotateEvents(eventsData, calendarConfigs, existingPeople);

      // format events to match what the UI expects if needed

      setEvents(eventsData);

      // Extract unique attendees and save to localStorage
      const peopleMap = new Map();
      existingPeople.forEach(person => peopleMap.set(person.email, person));

      eventsData.forEach(event => {
        if (event.attendees) {
          event.attendees.forEach(attendee => {
            if (attendee.email && !peopleMap.has(attendee.email)) {
              const name = attendee.displayName || attendee.email;
              const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

              // Find a color that hasn't been used yet, or fallback to hashing if we run out
              const usedColors = Array.from(peopleMap.values()).map(p => p.color);
              let newColor = AVATAR_ICON_COLORS.find(c => !usedColors.includes(c));

              if (!newColor) {
                // Fallback: Generate a random hex if palette is exhausted
                newColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
              }

              peopleMap.set(attendee.email, {
                name: name,
                initials: initials,
                email: attendee.email,
                color: newColor
              });
            }
          });
        }
      });

      const newPeopleDB = Array.from(peopleMap.values());
      setPeopleDB(newPeopleDB);

      if (newPeopleDB.length > existingPeople.length) {
        try {
          await persistSettings(calendarConfigs, newPeopleDB);
        } catch (e) {
          console.error('Failed to save discovered people', e);
        }
      }

    } catch (error) {
      console.error('Failed to load events', error);
      if (error.message.includes('401') || error.message.includes('403')) {
        // Token might be expired
        logout();
        setErrorMSG('Session expired. Please log in again.');
      } else {
        setErrorMSG(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadCalendars();
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      loadEvents();
    }
  }, [currentDate, accessToken, calendarConfigs]);

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
    localStorage.setItem('selected_date', newDate.toISOString());
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
    localStorage.setItem('selected_date', newDate.toISOString());
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    localStorage.setItem('selected_date', today.toISOString());
  };

  const handleSaveAttendees = async (updatedPeople) => {
    setPeopleDB(updatedPeople);
    try {
      await persistSettings(calendarConfigs, updatedPeople);
    } catch (e) {
      console.error('Error saving people to backend:', e);
    }
  };

  const handleSaveCalendars = async (newConfigs) => {
    setCalendarConfigs(newConfigs);
    try {
      await persistSettings(newConfigs, peopleDB);
    } catch (e) {
      console.error('Error saving calendars to backend:', e);
    }
  };

  return (
    <div className="app-container glass">
      <header className="app-header">
        <h1>Family <span className="highlight-text">Calendar</span></h1>

        {accessToken && (
          <CalendarHeader
            currentDate={currentDate}
            onPrev={handlePrevWeek}
            onNext={handleNextWeek}
            onToday={handleToday}
            onRefresh={loadEvents}
          />
        )}

        <div className="auth-controls" style={{ display: 'flex', alignItems: 'center' }}>
          {accessToken && calendars.length > 0 && (
            <button className="control-btn glass" style={{ marginRight: '1rem' }} onClick={() => setIsCalendarSelectorOpen(true)}>📅 Calendars</button>
          )}

          {accessToken && (
            <button className="control-btn glass" style={{ marginRight: '1rem' }} onClick={() => setIsEditorOpen(true)}>👥 Attendees</button>
          )}

          {accessToken ? (
            <button className="control-btn glass" onClick={logout}>Sign Out</button>
          ) : (
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

        {!accessToken ? (
          <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            Please sign in to view your calendar events.
          </div>
        ) : loading ? (
          <div className="loading-state glass" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading your schedule...</div>
        ) : (() => {
          const filteredEvents = filterHiddenAttendees(events, peopleDB);
          return <WeekGrid currentDate={currentDate} events={filteredEvents} />;
        })()}
      </main>

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

      {isDebugMode && accessToken && isAdmin && (
        <>
          <button
            onClick={() => setIsDebugModalOpen(true)}
            title="Open Debug Panel"
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
              if (accessToken) {
                await saveSettings(accessToken, configs, people);
              }
            }}
            onFullReset={handleFullReset}
          />
        </>
      )}
    </div>
  );
}

export default App;
