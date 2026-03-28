import { apiClient } from './apiClient';
import { 
  GoogleCalendarEvent, 
  GoogleCalendar, 
  CalendarConfig, 
  Person,
  UserSettingsResponse,
  AuthExchangeResponse,
  SuccessResponse
} from 'common/types';

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

// ─── Settings ────────────────────────────────────────────────────────────────

export const fetchSettings = async (token: string): Promise<UserSettingsResponse> =>
    apiClient<UserSettingsResponse>('/api/settings', { headers: authHeader(token) });

export const saveSettings = async (token: string, calendarConfigs: Record<string, CalendarConfig>, people: Person[]): Promise<SuccessResponse> =>
    apiClient<SuccessResponse>('/api/settings', {
        method: 'PUT',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarConfigs, people }),
    });

export const resetSettings = async (token: string): Promise<SuccessResponse> =>
    apiClient<SuccessResponse>('/api/settings/reset', {
        method: 'POST',
        headers: authHeader(token),
    });

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Check the current authentication status (supports Cloudflare Access).
 */
export const checkAuthStatus = async (token?: string | null): Promise<AuthExchangeResponse & { hasRefreshToken: boolean }> =>
    apiClient<AuthExchangeResponse & { hasRefreshToken: boolean }>('/api/auth/status', {
        headers: token ? authHeader(token) : {}
    });

/**
 * Exchange a one-time Google authorization code for a local session token.
 */
export const exchangeCode = async (code: string): Promise<AuthExchangeResponse> =>
    apiClient<AuthExchangeResponse>('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    });

// ─── Google Calendar (proxied via backend) ────────────────────────────────────

export const fetchCalendars = async (token: string): Promise<GoogleCalendar[]> =>
    apiClient<GoogleCalendar[]>('/api/calendar/list', { headers: authHeader(token) });

/**
 * Fetch calendar events for the given time range via the backend.
 * @param token - The local session token (JWT)
 * @param timeMin - ISO 8601 string
 * @param timeMax - ISO 8601 string
 */
export const fetchEvents = async (token: string, timeMin: string, timeMax: string): Promise<GoogleCalendarEvent[]> =>
    apiClient<GoogleCalendarEvent[]>(`/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, {
        headers: authHeader(token),
    });
