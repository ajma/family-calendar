import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import {
    initializeDb,
    getUserSettings,
    saveUserSettings,
    saveUserTokens,
    getUserTokens,
    clearAllUserSettings,
} from './db.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── OAuth2 client (used for code exchange and token refresh) ────────────────

const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'postmessage' // redirect_uri used by @react-oauth/google auth-code flow
);

// ─── Middleware: authenticate local session via JWT ─────────────────────────

async function authenticateSession(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('bearer '))) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { email: decoded.email };
        next();
    } catch (error) {
        console.error('Session authentication error:', error);
        res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }
}

/**
 * Returns a fresh Google access token for the given user by using the stored
 * refresh token. Saves the new access token back to the DB.
 * Throws with a 401-suitable message if no refresh token is stored.
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

// Initialize database
await initializeDb();
console.log('SQLite database initialized.');

// ─── Auth endpoints ──────────────────────────────────────────────────────────

/**
 * POST /api/auth/exchange
 * Receives a one-time Google auth code from the frontend, exchanges it for
 * tokens via the OAuth2 client, stores the refresh token in the DB, and
 * returns the short-lived access token + expiry to the client.
 */
app.post('/api/auth', async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'Auth code is required' });
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        // tokens: { access_token, refresh_token, expiry_date, token_type, scope }

        // Identify the user from the new access token
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!userInfoRes.ok) {
            return res.status(401).json({ error: 'Failed to identify user from exchanged token' });
        }
        const { email } = await userInfoRes.json();

        // Persist tokens
        await saveUserTokens(email, tokens.access_token, tokens.refresh_token, tokens.expiry_date);

        // Issue a local session token (JWT)
        const sessionToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            session_token: sessionToken,
            email: email
        });
    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({ error: 'Failed to exchange auth code' });
    }
});

// ─── Google Calendar proxy endpoints ─────────────────────────────────────────

/**
 * GET /api/calendars
 * Returns the authenticated user's Google Calendar list.
 * Uses the stored refresh token to obtain a fresh access token server-side.
 */
app.get('/api/calendars', authenticateSession, async (req, res) => {
    try {
        const googleToken = await getFreshAccessToken(req.user.email);
        const response = await fetch(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList',
            { headers: { Authorization: `Bearer ${googleToken}` } }
        );
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: err.error?.message || 'Failed to fetch calendars from Google' });
        }
        const data = await response.json();
        res.json(data.items || []);
    } catch (error) {
        console.error('Error fetching calendars:', error);
        res.status(error.status || 500).json({ error: error.message || 'Failed to fetch calendars' });
    }
});

/**
 * GET /api/events?timeMin=...&timeMax=...
 * Returns events for all selected calendars in the given time range.
 * The selected calendar IDs are read from the user's stored settings.
 * Uses the stored refresh token to obtain a fresh access token server-side.
 */
app.get('/api/events', authenticateSession, async (req, res) => {
    const { timeMin, timeMax } = req.query;
    if (!timeMin || !timeMax) {
        return res.status(400).json({ error: 'timeMin and timeMax query parameters are required' });
    }

    try {
        const googleToken = await getFreshAccessToken(req.user.email);
        const settings = await getUserSettings(req.user.email);
        const calendarConfigs = settings?.calendarConfigs || {};

        // Only fetch calendars the user has selected
        const selectedCalendarIds = Object.entries(calendarConfigs)
            .filter(([, config]) => config.selected)
            .map(([id]) => id);

        if (selectedCalendarIds.length === 0) {
            return res.json([]);
        }

        const queryParams = new URLSearchParams({
            timeMin,
            timeMax,
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '250',
        });

        const fetchCalendarEvents = async (calId) => {
            const config = calendarConfigs[calId] || {};
            const params = new URLSearchParams(queryParams);
            if (config.hashtag) params.append('q', config.hashtag);

            const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${googleToken}` },
            });
            if (!response.ok) {
                console.warn(`Failed to fetch events for calendar ${calId}: ${response.status}`);
                return [];
            }
            const data = await response.json();
            return (data.items || []).map(event => ({ ...event, _calendarId: calId }));
        };

        const results = await Promise.all(selectedCalendarIds.map(fetchCalendarEvents));
        const allEvents = results.flat();

        // Deduplicate, filter private/#ignore events, sort
        const seenIds = new Set();
        const uniqueEvents = [];
        for (const event of allEvents) {
            if (event.visibility === 'private') continue;
            if (event.description?.includes('#ignore')) continue;
            if (!seenIds.has(event.id)) {
                seenIds.add(event.id);
                uniqueEvents.push(event);
            }
        }
        uniqueEvents.sort((a, b) => {
            const tA = new Date(a.start.dateTime || a.start.date).getTime();
            const tB = new Date(b.start.dateTime || b.start.date).getTime();
            return tA - tB;
        });

        res.json(uniqueEvents);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(error.status || 500).json({ error: error.message || 'Failed to fetch events' });
    }
});


// ─── Settings endpoints ──────────────────────────────────────────────────────

app.get('/api/settings', authenticateSession, async (req, res) => {
    try {
        const userId = req.user.email;
        const adminEmail = process.env.ADMIN_EMAIL;
        const isAdmin = Boolean(adminEmail && userId === adminEmail);

        const settings = await getUserSettings(userId);
        if (!settings) {
            return res.json({ calendarConfigs: {}, people: [], isAdmin });
        }
        res.json({
            calendarConfigs: settings.calendarConfigs || {},
            people: settings.people || [],
            isAdmin,
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.put('/api/settings', authenticateSession, async (req, res) => {
    try {
        const userId = req.user.email;
        const { calendarConfigs, people } = req.body;
        await saveUserSettings(userId, calendarConfigs, people);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

app.post('/api/settings/reset', authenticateSession, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const adminEmail = process.env.ADMIN_EMAIL;

        if (!adminEmail || userEmail !== adminEmail) {
            return res.status(403).json({ error: 'Only the admin can perform a full reset' });
        }

        await clearAllUserSettings();
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing all settings:', error);
        res.status(500).json({ error: 'Failed to clear all settings' });
    }
});

// ─── Static frontend ─────────────────────────────────────────────────────────

app.get('/env-config.js', (req, res) => {
    res.type('.js');
    res.send(`window._env_ = { 
        GOOGLE_CLIENT_ID: "${process.env.GOOGLE_CLIENT_ID || ''}"
    };`);
});

app.use(express.static(path.join(__dirname, '../dist')));

app.get(/^.*$/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Backend server running on port ${PORT}`);
    });
}

export default app;
