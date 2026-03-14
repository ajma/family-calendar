import { useState, useEffect } from 'react';
import { fetchSettings, saveSettings, fetchCalendars, fetchEvents } from '../services/backend';
import { annotateEvents, buildEmailMap } from '../utils/annotateEnrichment';
import { AVATAR_ICON_COLORS } from '../constants';
import { GoogleCalendarEvent, Calendar, CalendarConfig, Person } from '../types';

export function useCalendarData(sessionToken: string | null) {
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const savedDate = localStorage.getItem('selected_date');
    return savedDate ? new Date(savedDate) : new Date();
  });
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [calendarConfigs, setCalendarConfigs] = useState<Record<string, CalendarConfig>>(() => {
    try {
      const saved = localStorage.getItem('calendar_configs');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMSG, setErrorMSG] = useState<string | null>(null);
  const [peopleDB, setPeopleDB] = useState<Person[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('people') || '[]');
    } catch {
      return [];
    }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState(localStorage.getItem('user_email') || '');
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load initial settings
  useEffect(() => {
    const loadUserData = async () => {
      if (!sessionToken) return;
      try {
        const settings = await fetchSettings(sessionToken);
        setIsAdmin(!!settings.isAdmin);
        const email = settings.email || '';
        setUserEmail(email);
        localStorage.setItem('user_email', email);
        if (settings.calendarConfigs && Object.keys(settings.calendarConfigs).length > 0) {
          setCalendarConfigs(settings.calendarConfigs);
          localStorage.setItem('calendar_configs', JSON.stringify(settings.calendarConfigs));
        }
        if (settings.people && settings.people.length > 0) {
          setPeopleDB(settings.people);
          localStorage.setItem('people', JSON.stringify(settings.people));
        }
        setSettingsLoaded(true);
      } catch (e) {
        console.error('Failed to load settings from DB', e);
        // Set to true even on error so we don't hang discovery forever
        setSettingsLoaded(true);
      }
    };
    loadUserData();
  }, [sessionToken]);

  const persistSettings = async (configs: Record<string, CalendarConfig>, people: Person[]) => {
    localStorage.setItem('calendar_configs', JSON.stringify(configs));
    localStorage.setItem('people', JSON.stringify(people));
    if (sessionToken) {
      await saveSettings(sessionToken, configs, people);
    }
  };

  const loadCalendars = async () => {
    if (!sessionToken) return;
    try {
      const data = await fetchCalendars(sessionToken);
      setCalendars(data);

      const primaryCal = data.find(c => c.primary);
      if (primaryCal) {
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
    if (!sessionToken) return;
    setLoading(true);
    setErrorMSG(null);
    try {
      const dayOfWeek = currentDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() + mondayOffset);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      let eventsData = await fetchEvents(sessionToken, startOfWeek.toISOString(), endOfWeek.toISOString());
      eventsData = annotateEvents(eventsData, calendarConfigs, peopleDB);
      setEvents(eventsData);

      // Discover new people from attendees
      // Only run after settings are loaded to avoid recreating people that already exist in DB
      if (settingsLoaded) {
        const emailMap = buildEmailMap(peopleDB);
        let discoveredNew = false;
        const newPeopleList = [...peopleDB];

        eventsData.forEach(event => {
          if (event.attendees) {
            event.attendees.forEach(attendee => {
              if (attendee.email && !emailMap.has(attendee.email.toLowerCase())) {
                discoveredNew = true;
                const name = attendee.displayName || attendee.email;
                const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const usedColors = newPeopleList.map(p => p.color);
                let newColor = AVATAR_ICON_COLORS.find(c => !usedColors.includes(c));
                if (!newColor) {
                  newColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                }
                const newPerson = { name, initials, email: attendee.email, color: newColor, show: true };
                newPeopleList.push(newPerson);
                // Also add to map immediately to avoid duplicating within the same loop
                emailMap.set(attendee.email.toLowerCase(), newPerson);
              }
            });
          }
        });

        if (discoveredNew) {
          setPeopleDB(newPeopleList);
          persistSettings(calendarConfigs, newPeopleList).catch(e => console.error('discoveringPeopleError', e));
        }
      }
    } catch (error: unknown) {
      console.error('Failed to load events', error);
      setErrorMSG(error instanceof Error ? error.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionToken) {
      loadCalendars();
    }
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken) {
      loadEvents();
    }
  }, [currentDate, sessionToken, calendarConfigs]);

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

  const handleSaveAttendees = async (updatedPeople: Person[]) => {
    setPeopleDB(updatedPeople);
    await persistSettings(calendarConfigs, updatedPeople);
  };

  const handleSaveCalendars = async (newConfigs: Record<string, CalendarConfig>) => {
    setCalendarConfigs(newConfigs);
    await persistSettings(newConfigs, peopleDB);
  };

  return {
    currentDate,
    events,
    calendars,
    calendarConfigs,
    peopleDB,
    loading,
    errorMSG,
    isAdmin,
    userEmail,
    handlePrevWeek,
    handleNextWeek,
    handleToday,
    loadEvents,
    handleSaveAttendees,
    handleSaveCalendars
  };
}
