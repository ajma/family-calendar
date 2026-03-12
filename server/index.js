import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { OAuth2Client } from 'google-auth-library';
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

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── OAuth2 client (used for code exchange and token refresh) ────────────────

const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'postmessage' // redirect_uri used by @react-oauth/google auth-code flow
);

// ─── Middleware: verify a Google access token ────────────────────────────────

async function verifyGoogleToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('bearer '))) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            return res.status(401).json({ error: 'Invalid Google Token' });
        }

        const userData = await response.json();
        if (!userData.email) {
            return res.status(401).json({ error: 'Unable to get email from user profile' });
        }

        req.user = userData;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
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
app.post('/api/auth/exchange', async (req, res) => {
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

        // Persist tokens (refresh_token is only returned on the first authorization)
        await saveUserTokens(email, tokens.access_token, tokens.refresh_token, tokens.expiry_date);

        res.json({
            access_token: tokens.access_token,
            expiry_date:  tokens.expiry_date,
        });
    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({ error: 'Failed to exchange auth code' });
    }
});

/**
 * POST /api/auth/refresh
 * Uses the stored refresh token for the authenticated user to silently obtain
 * a new access token. The caller must send a still-valid Bearer token so
 * verifyGoogleToken can identify them.
 */
app.post('/api/auth/refresh', verifyGoogleToken, async (req, res) => {
    const userId = req.user.email;

    try {
        const stored = await getUserTokens(userId);
        if (!stored?.refreshToken) {
            return res.status(401).json({ error: 'No refresh token stored for this user. Please sign in again.' });
        }

        oauth2Client.setCredentials({ refresh_token: stored.refreshToken });
        const { credentials } = await oauth2Client.refreshAccessToken();
        // credentials: { access_token, expiry_date, token_type, ... }

        // Update the stored access token (refresh token stays the same)
        await saveUserTokens(userId, credentials.access_token, null, credentials.expiry_date);

        res.json({
            access_token: credentials.access_token,
            expiry_date:  credentials.expiry_date,
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh access token' });
    }
});

// ─── Settings endpoints ──────────────────────────────────────────────────────

app.get('/api/settings', verifyGoogleToken, async (req, res) => {
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

app.put('/api/settings', verifyGoogleToken, async (req, res) => {
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

app.post('/api/settings/reset', verifyGoogleToken, async (req, res) => {
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
