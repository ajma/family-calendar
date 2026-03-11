import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB
async function getDb() {
    const dbFile = process.env.NODE_ENV === 'test' ? 'database.test.sqlite' : 'database.sqlite';
    return open({
        filename: path.join(__dirname, dbFile),
        driver: sqlite3.Database
    });
}

// Ensure tables exist
export async function initializeDb() {
    const db = await getDb();
    await db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      calendar_configs TEXT,
      people TEXT
    )
  `);
    return db;
}

export async function getUserSettings(userId) {
    const db = await getDb();
    const result = await db.get('SELECT calendar_configs, people FROM user_settings WHERE id = ?', [userId]);
    if (!result) return null;
    return {
        calendarConfigs: result.calendar_configs ? JSON.parse(result.calendar_configs) : null,
        people: result.people ? JSON.parse(result.people) : null
    };
}

export async function saveUserSettings(userId, calendarConfigs, people) {
    const db = await getDb();
    await db.run(
        `INSERT INTO user_settings (id, calendar_configs, people) 
     VALUES (?, ?, ?) 
     ON CONFLICT(id) DO UPDATE SET 
       calendar_configs = excluded.calendar_configs,
       people = excluded.people`,
        [userId, JSON.stringify(calendarConfigs || {}), JSON.stringify(people || [])]
    );
}
