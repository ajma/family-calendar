import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDb } from './db.js';

// Routes
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import calendarRoutes from './routes/calendar.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize database
await initializeDb();
console.log('SQLite database initialized.');

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/calendar', calendarRoutes);

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
