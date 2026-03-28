export interface Attendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: string;
  summaryOverride?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Attendee[];
  colorId?: string;
  visibility?: 'public' | 'private' | 'default';
  status?: string;
  htmlLink?: string;
  _calendarId?: string;
}

export interface CalendarConfig {
  id: string;
  selected?: boolean;
  emoji?: string | null;
  hashtag?: string;
  assignment?: string;
}

export interface Person {
  id?: string;
  email: string;
  name: string;
  initials: string;
  color: string;
  show: boolean;
  avatar?: string;
  hidden?: boolean;
  alternateEmails?: string[];
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface UserSettingsResponse {
  email: string;
  calendarConfigs: Record<string, CalendarConfig>;
  people: Person[];
  isAdmin: boolean;
  isNewUser: boolean;
}

export interface AuthExchangeResponse {
  session_token: string | null;
  email: string | null;
}

export interface SuccessResponse {
  success: boolean;
}

export interface ErrorResponse {
  error: string;
}
