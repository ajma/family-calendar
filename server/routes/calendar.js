import express from 'express';
import { authenticateSession } from '../middleware/auth.js';
import { getUserTokens, saveUserTokens, getUserSettings } from '../db.js';
import { OAuth2Client } from 'google-auth-library';
import { processEvents } from '../services/eventService.js';

const router = express.Router();

const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'postmessage'
);

/**
 * Helper to obtain a fresh Google access token.
 */
async function getFreshAccessToken(userId) {
    const stored = await getUserTokens(userId);
    if (!stored?.refreshToken) {
        const err = new Error('No refresh token stored. Please sign in again.');
        err.status = 401;
        throw err;
    }
    oauth2Client.setCredentials({ refresh_token: stored.refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    await saveUserTokens(userId, credentials.access_token, null, credentials.expiry_date);
    return credentials.access_token;
}

/**
 * GET /api/calendar/list
 */
router.get('/list', authenticateSession, async (req, res) => {
    try {
        const googleToken = await getFreshAccessToken(req.user.email);
        const response = await fetch(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList',
            { headers: { Authorization: `Bearer ${googleToken}` } }
        );
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: err.error?.message || 'Failed to fetch calendars' });
        }
        
        const data = await response.json();
        res.json(data.items || []);
    } catch (error) {
        console.error('Error fetching calendars:', error);
        res.status(error.status || 500).json({ error: error.message || 'Failed to fetch calendars' });
    }
});

/**
 * GET /api/calendar/events
 */
router.get('/events', authenticateSession, async (req, res) => {
    const { timeMin, timeMax } = req.query;
    if (!timeMin || !timeMax) {
        return res.status(400).json({ error: 'timeMin and timeMax are required' });
    }

    try {
        const googleToken = await getFreshAccessToken(req.user.email);
        const settings = await getUserSettings(req.user.email);
        const calendarConfigs = settings?.calendarConfigs || {};

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

        const fetchCalendarEvents = async (calId) => {
            const config = calendarConfigs[calId] || {};
            const params = new URLSearchParams(queryParams);
            if (config.hashtag) params.append('q', config.hashtag);

            const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`;
            const response = await fetch(url, { headers: { Authorization: `Bearer ${googleToken}` } });
            
            if (!response.ok) return [];
            const data = await response.json();
            return (data.items || []).map(event => ({ ...event, _calendarId: calId }));
        };

        const results = await Promise.all(selectedCalendarIds.map(fetchCalendarEvents));
        const processed = processEvents(results.flat());
        res.json(processed);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(error.status || 500).json({ error: error.message || 'Failed to fetch events' });
    }
});

export default router;
