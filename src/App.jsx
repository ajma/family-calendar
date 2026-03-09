import { useState, useEffect } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import CalendarHeader from './components/CalendarHeader';
import WeekGrid from './components/WeekGrid';
import { fetchEvents, fetchCalendars } from './services/googleCalendar';
import './index.css';
import './styles/calendar.css';

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendar, setSelectedCalendar] = useState(localStorage.getItem('selected_calendar') || 'primary');
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState(localStorage.getItem('oauth_token') || null);
  const [errorMSG, setErrorMSG] = useState(null);

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
    localStorage.removeItem('oauth_token');
  };

  const loadCalendars = async () => {
    if (!accessToken) return;
    try {
      const data = await fetchCalendars(accessToken);
      setCalendars(data);
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

      const data = await fetchEvents(accessToken, selectedCalendar, startOfWeek.toISOString(), endOfWeek.toISOString());
      
      // format events to match what the UI expects if needed
      setEvents(data);
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
  }, [currentDate, accessToken, selectedCalendar]);

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="app-container glass">
      <header className="app-header">
        <h1>Calendar<span className="highlight-text">Sync</span></h1>
        
        {accessToken && (
          <CalendarHeader 
            currentDate={currentDate} 
            onPrev={handlePrevWeek} 
            onNext={handleNextWeek}
            onToday={handleToday}
          />
        )}

        <div className="auth-controls" style={{display: 'flex', alignItems: 'center'}}>
          {accessToken && calendars.length > 0 && (
            <select 
              value={selectedCalendar} 
              onChange={(e) => {
                setSelectedCalendar(e.target.value);
                localStorage.setItem('selected_calendar', e.target.value);
              }}
              style={{ padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', background: 'var(--surface-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', marginRight: '1rem', maxWidth: '300px'}}
            >
              {calendars.map(cal => (
                <option key={cal.id} value={cal.id}>{cal.summary}</option>
              ))}
            </select>
          )}

          {accessToken ? (
            <button className="control-btn" onClick={logout}>Sign Out</button>
          ) : (
            <button className="control-btn" style={{background: 'var(--accent-blue)', color: 'white', border: 'none'}} onClick={() => login()}>Sign In with Google</button>
          )}
        </div>
      </header>
      
      <main className="app-main">
        {errorMSG && (
          <div className="error-message" style={{color: '#ff7b72', textAlign: 'center', marginBottom: '1rem', background: 'rgba(255,123,114,0.1)', padding: '1rem', borderRadius: '8px'}}>
             {errorMSG}
          </div>
        )}

        {!accessToken ? (
          <div className="empty-state" style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'}}>
             Please sign in to view your calendar events.
          </div>
        ) : loading ? (
          <div className="loading-state glass" style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading your schedule...</div>
        ) : (
          <WeekGrid currentDate={currentDate} events={events} />
        )}
      </main>
    </div>
  );
}

export default App;
