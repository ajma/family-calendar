import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { encrypt, decrypt } from './crypto';
import { CalendarConfig, Person } from '../common/types';
import { UserSettings, StoredTokens } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB
let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
    if (dbInstance) return dbInstance;

    const dbFile = process.env.NODE_ENV === 'test' ? 'database.test.sqlite' : 'database.sqlite';
    const dbDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    dbInstance = await open({
        filename: path.join(dbDir, dbFile),
        driver: sqlite3.Database
    });
    return dbInstance;
}

export async function closeDb(): Promise<void> {
    if (dbInstance) {
        await dbInstance.close();
        dbInstance = null;
    }
}

// Ensure tables exist and run any pending column migrations
export async function initializeDb(): Promise<Database> {
    const db = await getDb();

    await db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      calendar_configs TEXT,
      people TEXT
    )
  `);

    // Migration: add token columns for refresh token support (safe to run on existing DBs)
    for (const col of [
        'refresh_token TEXT',
        'access_token TEXT',
        'token_expiry INTEGER',
    ]) {
        try {
            await db.exec(`ALTER TABLE user_settings ADD COLUMN ${col}`);
        } catch {
            // Column already exists — safe to ignore
        }
    }

    return db;
}

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
    const db = await getDb();
    const result = await db.get('SELECT calendar_configs, people FROM user_settings WHERE id = ?', [userId]);
    if (!result) return null;
    return {
        calendarConfigs: result.calendar_configs ? JSON.parse(result.calendar_configs) : null,
        people: result.people ? JSON.parse(result.people) : null,
    };
}

export async function saveUserSettings(userId: string, calendarConfigs: Record<string, CalendarConfig>, people: Person[]): Promise<void> {
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

/**
 * Save (or update) the OAuth tokens for a user.
 * Called after a successful code exchange or token refresh.
 */
export async function saveUserTokens(userId: string, accessToken: string | null, refreshToken: string | null, tokenExpiry: number | null): Promise<void> {
    const db = await getDb();
    const encryptedAccess = accessToken ? encrypt(accessToken) : null;
    const encryptedRefresh = refreshToken ? encrypt(refreshToken) : null;
    
    await db.run(
        `INSERT INTO user_settings (id, access_token, refresh_token, token_expiry)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       access_token   = excluded.access_token,
       refresh_token  = COALESCE(excluded.refresh_token, user_settings.refresh_token),
       token_expiry   = excluded.token_expiry`,
        [userId, encryptedAccess, encryptedRefresh, tokenExpiry ?? null]
    );
}

/**
 * Retrieve stored OAuth tokens for a user.
 * Returns null if no record exists.
 */
export async function getUserTokens(userId: string): Promise<StoredTokens | null> {
    const db = await getDb();
    const result = await db.get(
        'SELECT access_token, refresh_token, token_expiry FROM user_settings WHERE id = ?',
        [userId]
    );
    if (!result) return null;
    return {
        accessToken:  result.access_token ? decrypt(result.access_token) : null,
        refreshToken: result.refresh_token ? decrypt(result.refresh_token) : null,
        tokenExpiry:  result.token_expiry,
    };
}

export async function clearAllUserSettings(): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM user_settings');
}
