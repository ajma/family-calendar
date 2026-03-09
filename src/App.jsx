import { useState, useEffect } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import CalendarHeader from './components/CalendarHeader';
import WeekGrid from './components/WeekGrid';
import AttendeeEditor from './components/AttendeeEditor';
import CalendarSelectorModal from './components/CalendarSelectorModal';
import { fetchEvents, fetchCalendars } from './services/googleCalendar';
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
  const [selectedCalendars, setSelectedCalendars] = useState(() => {
    try {
      const saved = localStorage.getItem('selected_calendars');
      return saved ? JSON.parse(saved) : ['primary'];
    } catch {
      return ['primary'];
    }
  });
  const [calendarAssignments, setCalendarAssignments] = useState(() => {
    try {
      const saved = localStorage.getItem('calendar_assignments');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState(localStorage.getItem('oauth_token') || null);
  const [errorMSG, setErrorMSG] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCalendarSelectorOpen, setIsCalendarSelectorOpen] = useState(false);
  const [peopleDB, setPeopleDB] = useState([]);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      localStorage.setItem('oauth_token', tokenResponse.access_token);
      setErrorMSG(null);
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
    setEvents([]);
    setCalendars([]);
    setSelectedCalendars(['primary']);
    setCalendarAssignments({});
    setPeopleDB([]);
    setCurrentDate(new Date());
    localStorage.clear();
  };

  const loadCalendars = async () => {
    if (!accessToken) return;
    try {
      const data = await fetchCalendars(accessToken);
      setCalendars(data);
      
      const primaryCal = data.find(c => c.primary);
      if (primaryCal) {
        setSelectedCalendars(prev => {
          if (prev.includes('primary')) {
            const newSelection = prev.map(id => id === 'primary' ? primaryCal.id : id);
            localStorage.setItem('selected_calendars', JSON.stringify(newSelection));
            return newSelection;
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

      let eventsData = await fetchEvents(accessToken, selectedCalendars, startOfWeek.toISOString(), endOfWeek.toISOString());

      // Read existing people to use for assignment
      const existingPeople = JSON.parse(localStorage.getItem('people') || '[]');

      // Auto-assign attendees based on calendar assignments
      eventsData = eventsData.map(event => {
        const assignedEmail = calendarAssignments[event._calendarId];
        if (assignedEmail) {
          const person = existingPeople.find(p => p.email === assignedEmail);
          const attendees = event.attendees ? [...event.attendees] : [];
          if (person && !attendees.some(a => a.email === assignedEmail)) {
            attendees.push({ email: person.email, displayName: person.name || person.email, responseStatus: 'accepted' });
            return { ...event, attendees };
          }
        }
        return event;
      });

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
      localStorage.setItem('people', JSON.stringify(newPeopleDB));
      setPeopleDB(newPeopleDB);

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
  }, [currentDate, accessToken, selectedCalendars, calendarAssignments]);

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

  const handleSaveAttendees = (updatedPeople) => {
    localStorage.setItem('people', JSON.stringify(updatedPeople));
    setPeopleDB(updatedPeople);
    // Force a re-render of events to reflect new colors/initials
    setEvents([...events]);
  };

  const handleSaveCalendars = (newSelection, newAssignments) => {
    setSelectedCalendars(newSelection);
    setCalendarAssignments(newAssignments);
    localStorage.setItem('selected_calendars', JSON.stringify(newSelection));
    localStorage.setItem('calendar_assignments', JSON.stringify(newAssignments));
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
          />
        )}

        <div className="auth-controls" style={{ display: 'flex', alignItems: 'center' }}>
          {accessToken && calendars.length > 0 && (
            <button className="control-btn" style={{ marginRight: '1rem', background: 'var(--surface-color)' }} onClick={() => setIsCalendarSelectorOpen(true)}>Select Calendars</button>
          )}

          {accessToken && (
            <button className="control-btn" style={{ marginRight: '1rem', background: 'var(--surface-color)' }} onClick={() => setIsEditorOpen(true)}>Edit Attendees</button>
          )}

          {accessToken ? (
            <button className="control-btn" onClick={logout}>Sign Out</button>
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
        ) : (
          <WeekGrid currentDate={currentDate} events={events} />
        )}
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
        selectedCalendars={selectedCalendars}
        calendarAssignments={calendarAssignments}
        people={peopleDB}
        onSave={handleSaveCalendars}
      />
    </div>
  );
}

export default App;
