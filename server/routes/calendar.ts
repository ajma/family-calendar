import express, { Response } from 'express';
import { authenticateSession, AuthenticatedRequest } from '../middleware/auth';
import { getUserTokens, saveUserTokens, getUserSettings } from '../db';
import { OAuth2Client } from 'google-auth-library';
import { processEvents } from '../services/eventService';
import { CalendarConfig, GoogleCalendarEvent } from '../../common/types';

const router = express.Router();

const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'postmessage'
);

interface HttpError extends Error {
    status?: number;
}

/**
 * Helper to obtain a fresh Google access token.
 */
async function getFreshAccessToken(userId: string): Promise<string | null | undefined> {
    const stored = await getUserTokens(userId);
    if (!stored?.refreshToken) {
        const err: HttpError = new Error('No refresh token stored. Please sign in again.');
        err.status = 401;
        throw err;
    }
    oauth2Client.setCredentials({ refresh_token: stored.refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    await saveUserTokens(userId, credentials.access_token || null, null, credentials.expiry_date || null);
    return credentials.access_token;
}

/**
 * GET /api/calendar/list
 */
router.get('/list', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'User not authenticated' });
        const googleToken = await getFreshAccessToken(req.user.email);
        if (!googleToken) return res.status(401).json({ error: 'Could not obtain Google access token' });

        const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
            headers: { Authorization: `Bearer ${googleToken}` },
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: err.error?.message || 'Failed to fetch calendars' });
        }
        
        const data = await response.json();
        res.json(data.items || []);
    } catch (error: unknown) {
        const httpErr = error as HttpError;
        console.error('Error fetching calendars:', httpErr);
        res.status(httpErr.status || 500).json({ error: httpErr.message || 'Failed to fetch calendars' });
    }
});

/**
 * GET /api/calendar/events
 */
router.get('/events', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    const { timeMin, timeMax } = req.query as { timeMin?: string, timeMax?: string };
    if (!timeMin || !timeMax) {
        return res.status(400).json({ error: 'timeMin and timeMax are required' });
    }

    try {
        if (!req.user) return res.status(401).json({ error: 'User not authenticated' });
        const googleToken = await getFreshAccessToken(req.user.email);
        const settings = await getUserSettings(req.user.email);
        const calendarConfigs: Record<string, CalendarConfig> = (settings?.calendarConfigs || {});

        const selectedCalendarIds = Object.entries(calendarConfigs)
            .filter(([, config]) => config.selected)
            .map(([id]) => id);

        if (selectedCalendarIds.length === 0) return res.json([]);

        const queryParams = new URLSearchParams({
            timeMin, timeMax,
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '250',
        });

        const fetchCalendarEvents = async (calId: string): Promise<GoogleCalendarEvent[]> => {
            const config = calendarConfigs[calId] || {};
            const params = new URLSearchParams(queryParams);
            if (config.hashtag) params.append('q', config.hashtag);

            const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`;
            const response = await fetch(url, { headers: { Authorization: `Bearer ${googleToken}` } });
            
            if (!response.ok) return [];
            const data = await response.json();
            return (data.items || []).map((event: GoogleCalendarEvent) => ({ ...event, _calendarId: calId }));
        };

        const results = await Promise.all(selectedCalendarIds.map(fetchCalendarEvents));
        const processed = processEvents(results.flat());
        res.json(processed);
    } catch (error: unknown) {
        const httpErr = error as HttpError;
        console.error('Error fetching events:', httpErr);
        res.status(httpErr.status || 500).json({ error: httpErr.message || 'Failed to fetch events' });
    }
});

export default router;
