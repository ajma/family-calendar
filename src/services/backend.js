import { apiClient } from './apiClient.js';

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// ─── Settings ────────────────────────────────────────────────────────────────

export const fetchSettings = async (token) =>
    apiClient('/api/settings', { headers: authHeader(token) });

export const saveSettings = async (token, calendarConfigs, people) =>
    apiClient('/api/settings', {
        method: 'PUT',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarConfigs, people }),
    });

export const resetSettings = async (token) =>
    apiClient('/api/settings/reset', {
        method: 'POST',
        headers: authHeader(token),
    });

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Exchange a one-time Google authorization code for a local session token.
 * @returns {{ session_token: string, email: string }} 
 */
export const exchangeCode = async (code) =>
    apiClient('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    });

// ─── Google Calendar (proxied via backend) ────────────────────────────────────

export const fetchCalendars = async (token) =>
    apiClient('/api/calendar/list', { headers: authHeader(token) });

/**
 * Fetch calendar events for the given time range via the backend.
 * @param {string} token - The local session token (JWT)
 * @param {string} timeMin - ISO 8601 string
 * @param {string} timeMax - ISO 8601 string
 */
export const fetchEvents = async (token, timeMin, timeMax) =>
    apiClient(`/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, {
        headers: authHeader(token),
    });
