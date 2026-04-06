import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchSettings, saveSettings, fetchCalendars, fetchEvents } from '../services/backend';
import { annotateEvents, buildEmailMap, cleanupHiddenEvents } from '../utils/annotateEnrichment';
import { AVATAR_ICON_COLORS } from '../constants';
import { GoogleCalendarEvent, GoogleCalendar, CalendarConfig, Person, Appearance, HiddenEvent } from '../../common/types';

interface CalendarContextType {
  currentDate: Date;
  events: GoogleCalendarEvent[];
  calendars: GoogleCalendar[];
  calendarConfigs: Record<string, CalendarConfig>;
  peopleDB: Person[];
  loading: boolean;
  errorMSG: string | null;
  isAdmin: boolean;
  userEmail: string;
  isNewUser: boolean;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  handlePrevWeek: () => void;
  handleNextWeek: () => void;
  handleToday: () => void;
  loadEvents: (configsOverride?: Record<string, CalendarConfig>, peopleOverride?: Person[]) => Promise<void>;
  handleSaveAttendees: (people: Person[]) => Promise<void>;
  handleSaveCalendars: (configs: Record<string, CalendarConfig>) => Promise<void>;
  persistSettings: (configs: Record<string, CalendarConfig>, people: Person[], appSettings?: Appearance) => Promise<void>;
  isEventEditMode: boolean;
  setIsEventEditMode: (val: boolean) => void;
  toggleHiddenEvent: (event: GoogleCalendarEvent, hide: boolean) => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType | null>(null);

export function useCalendarContext() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendarContext must be used within a CalendarProvider');
  }
  return context;
}

interface CalendarProviderProps {
  children: ReactNode;
  sessionToken: string | null;
}

export function CalendarProvider({ children, sessionToken }: CalendarProviderProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const savedDate = localStorage.getItem('selected_date');
    return savedDate ? new Date(savedDate) : new Date();
  });
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
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
  const [appearance, setAppearanceState] = useState<Appearance>(() => {
    const local = localStorage.getItem('appearance');
    return local ? JSON.parse(local) : { theme: 'light' };
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isEventEditMode, setIsEventEditMode] = useState(false);

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
        
        const finalConfigs = settings.calendarConfigs || {};
        const finalPeople = settings.people || [];

        if (Object.keys(finalConfigs).length > 0) {
          setCalendarConfigs(finalConfigs);
          localStorage.setItem('calendar_configs', JSON.stringify(finalConfigs));
        }
        if (finalPeople.length > 0) {
          setPeopleDB(finalPeople);
          localStorage.setItem('people', JSON.stringify(finalPeople));
        }
        
        // Mark as loaded before calling other effects
        setIsNewUser(!!settings.isNewUser);
        
        // Dynamic cleanup of old hidden events
        const prunedConfigs = cleanupHiddenEvents(finalConfigs);
        if (JSON.stringify(prunedConfigs) !== JSON.stringify(finalConfigs)) {
          persistSettings(prunedConfigs, finalPeople, settings.appearance).catch(e => console.error(e));
        }

        setSettingsLoaded(true);
        
        // Pass fresh data into initial loads to avoid race with local state
        loadEvents(prunedConfigs, finalPeople, true);
      } catch (e) {
        console.error('Failed to load settings from DB', e);
        setSettingsLoaded(true);
      }
    };
    loadUserData();
  }, [sessionToken]);

  // Sync theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appearance.theme || 'light');
  }, [appearance]);

  const setAppearance = (newAppearance: Appearance) => {
    setAppearanceState(newAppearance);
    persistSettings(calendarConfigs, peopleDB, newAppearance).catch(e => console.error(e));
  };

  const persistSettings = async (configs: Record<string, CalendarConfig>, people: Person[], appSettings: Appearance = appearance) => {
    localStorage.setItem('calendar_configs', JSON.stringify(configs));
    localStorage.setItem('people', JSON.stringify(people));
    if (appSettings) {
      localStorage.setItem('appearance', JSON.stringify(appSettings));
    }
    
    // Update local state immediately so UI refreshes correctly
    setCalendarConfigs(configs);
    setPeopleDB(people);
    if (appSettings) setAppearanceState(appSettings);

    if (sessionToken) {
      await saveSettings(sessionToken, configs, people, appSettings);
    }
  };

  const loadCalendars = async () => {
    if (!sessionToken || !settingsLoaded) return;
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
              localStorage.setItem('calendar_configs', JSON.stringify(newConfigs));
              // Auto-persist default selection so first load works
              persistSettings(newConfigs, peopleDB).catch(e => console.error('autoPersistError', e));
              return newConfigs;
            }
            return prev;
          });
        }
    } catch (error) {
      console.error('Failed to load calendars', error);
    }
  };

  const loadEvents = async (configsOverride?: Record<string, CalendarConfig>, peopleOverride?: Person[], ignoreSettingsLoaded: boolean = false) => {
    if (!sessionToken || (!settingsLoaded && !ignoreSettingsLoaded)) return;
    const currentConfigs = configsOverride || calendarConfigs;
    const currentPeople = peopleOverride || peopleDB;

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
      eventsData = annotateEvents(eventsData, currentConfigs, currentPeople);
      setEvents(eventsData);

      // Discover new people from attendees
      const emailMap = buildEmailMap(currentPeople);
      let discoveredNew = false;
      const newPeopleList = [...currentPeople];

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
        persistSettings(currentConfigs, newPeopleList).catch(e => console.error('discoveringPeopleError', e));
      }
    } catch (error: unknown) {
      console.error('Failed to load events', error);
      setErrorMSG(error instanceof Error ? error.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionToken && settingsLoaded) {
      loadCalendars();
    }
  }, [sessionToken, settingsLoaded]);

  useEffect(() => {
    if (sessionToken && settingsLoaded) {
      loadEvents();
    }
  }, [currentDate, sessionToken, calendarConfigs, settingsLoaded]);

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
    await persistSettings(calendarConfigs, updatedPeople);
    await loadEvents(calendarConfigs, updatedPeople);
  };

  const handleSaveCalendars = async (newConfigs: Record<string, CalendarConfig>) => {
    await persistSettings(newConfigs, peopleDB);
    await loadEvents(newConfigs, peopleDB);
  };

  const toggleHiddenEvent = async (event: GoogleCalendarEvent, hide: boolean) => {
    const targetCalendarId = event._calendarId || Object.keys(calendarConfigs).find(k => calendarConfigs[k].selected) || '';
    if (!targetCalendarId) return;

    const currentConfig = calendarConfigs[targetCalendarId] || { id: targetCalendarId };
    const currentHidden = currentConfig.hiddenEvents || [];
    const eventEndDate = event.end.dateTime || event.end.date || new Date().toISOString();
    
    let newHidden: (string | HiddenEvent)[];
    if (hide) {
      if (!currentHidden.some(item => (typeof item === 'string' ? item : item.id) === event.id)) {
        newHidden = [...currentHidden, { id: event.id, expiry: eventEndDate }];
      } else {
        newHidden = currentHidden;
      }
    } else {
      newHidden = currentHidden.filter(item => (typeof item === 'string' ? item : item.id) !== event.id);
    }

    const newConfigs = {
      ...calendarConfigs,
      [targetCalendarId]: {
        ...currentConfig,
        hiddenEvents: newHidden
      }
    };
    
    setCalendarConfigs(newConfigs);
    // Don't await full loadEvents to keep UI snappy, just persist
    await persistSettings(newConfigs, peopleDB);
  };

  const value = {
    currentDate,
    events,
    calendars,
    calendarConfigs,
    peopleDB,
    loading,
    errorMSG,
    isAdmin,
    userEmail,
    isNewUser,
    appearance,
    setAppearance,
    handlePrevWeek,
    handleNextWeek,
    handleToday,
    loadEvents,
    handleSaveAttendees,
    handleSaveCalendars,
    persistSettings,
    isEventEditMode,
    setIsEventEditMode,
    toggleHiddenEvent
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}
