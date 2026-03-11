import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDb, getUserSettings, saveUserSettings } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware to verify Google token
async function verifyGoogleToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('bearer '))) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            return res.status(401).json({ error: 'Invalid Google Token' });
        }

        const userData = await response.json();
        if (!userData.email) {
            return res.status(401).json({ error: 'Unable to get email from user profile' });
        }

        req.user = userData; // contains .email, .sub, etc.
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
}

// Initialize database
await initializeDb();
console.log('SQLite database initialized.');

app.get('/api/settings', verifyGoogleToken, async (req, res) => {
    try {
        const userId = req.user.email;
        const settings = await getUserSettings(userId);
        if (!settings) {
            return res.json({ calendarConfigs: {}, people: [] });
        }
        // ensure fallback lists exist even if previously saved correctly empty
        res.json({
            calendarConfigs: settings.calendarConfigs || {},
            people: settings.people || []
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

// Dynamically serve environment variables for the frontend
app.get('/env-config.js', (req, res) => {
    res.type('.js');
    res.send(`window._env_ = { GOOGLE_CLIENT_ID: "${process.env.GOOGLE_CLIENT_ID || ''}" };`);
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all to serve index.html for any other route (React Router support)
app.get(/^.*$/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Backend server running on port ${PORT}`);
    });
}

export default app;
