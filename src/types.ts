export interface Attendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
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
  id?: string;
  summary?: string;
  primary?: boolean;
  selected?: boolean;
  emoji?: string | null;
  hashtag?: string;
  assignments?: string[];
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

export interface Calendar {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: string;
  summaryOverride?: string;
}
