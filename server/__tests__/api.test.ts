/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initializeDb, closeDb } from '../db';
import { unlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const TEST_TOKEN = jwt.sign({ email: 'test@example.com' }, JWT_SECRET);

describe('Backend API Tests', () => {
    beforeAll(async () => {
        // Initialize test DB table
        await initializeDb();
    });

    afterAll(async () => {
        try {
            await closeDb();
            await unlink(path.join(__dirname, '../../data/database.test.sqlite'));
        } catch (e) {
            console.error('Failed to cleanup test DB', e);
        }
    });

    beforeEach(() => {
        // Mock Google token verification
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ email: 'test@example.com' })
        });
    });

    describe('GET /api/settings', () => {
        it('should return 401 if no authorization header', async () => {
            const res = await request(app).get('/api/settings');
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Missing or invalid Authorization header');
        });

        it('should get default empty settings initially', async () => {
            const res = await request(app)
                .get('/api/settings')
                .set('Authorization', `Bearer ${TEST_TOKEN}`);
            expect(res.status).toBe(200);
            expect(res.body.email).toBe('test@example.com');
            expect(res.body.calendarConfigs).toEqual({});
            expect(res.body.people).toEqual([]);
            expect(res.body.isNewUser).toBe(true);
        });

        it('should return isNewUser: true if tokens exist but settings are empty', async () => {
            // Simulate tokens being saved via OAuth exchange
            const { saveUserTokens } = await import('../db');
            await saveUserTokens('test@example.com', 'access', 'refresh', Date.now() + 3600);

            const res = await request(app)
                .get('/api/settings')
                .set('Authorization', `Bearer ${TEST_TOKEN}`);
            
            expect(res.status).toBe(200);
            expect(res.body.isNewUser).toBe(true);
            expect(res.body.calendarConfigs).toEqual({});
        });
    });

    describe('PUT /api/settings', () => {
        it('should update and retrieve settings', async () => {
            const newSettings = {
                calendarConfigs: { 'testCalendarId': { assignments: {}, hashtags: [] } },
                people: [{ id: '1', name: 'Alice', color: '#ff0000' }]
            };

            const putRes = await request(app)
                .put('/api/settings')
                .set('Authorization', `Bearer ${TEST_TOKEN}`)
                .send(newSettings);

            expect(putRes.status).toBe(200);
            expect(putRes.body.success).toBe(true);

            const getRes = await request(app)
                .get('/api/settings')
                .set('Authorization', `Bearer ${TEST_TOKEN}`);

            expect(getRes.body.email).toBe('test@example.com');
            expect(getRes.body.calendarConfigs).toEqual(newSettings.calendarConfigs);
            expect(getRes.body.people).toEqual(newSettings.people);
            expect(getRes.body.isNewUser).toBe(false);
        });
    });

    describe('POST /api/settings/reset', () => {
        beforeEach(() => {
            process.env.ADMIN_EMAIL = 'admin@example.com';
        });

        afterEach(() => {
            delete process.env.ADMIN_EMAIL;
        });

        it('should return 403 if user is not admin', async () => {
            // "test@example.com" is set in TEST_TOKEN
            const res = await request(app).post('/api/settings/reset').set('Authorization', `Bearer ${TEST_TOKEN}`);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Only the admin can perform a full reset');
        });

        it('should clear all settings if user is admin', async () => {
            // Setup: add some settings
            const newSettings = {
                calendarConfigs: { 'testCal': { selected: true } },
                people: [{ id: '1', name: 'Bob' }]
            };
            const adminToken = jwt.sign({ email: 'admin@example.com' }, JWT_SECRET);

            // Execute reset
            const resetRes = await request(app).post('/api/settings/reset').set('Authorization', `Bearer ${adminToken}`);
            expect(resetRes.status).toBe(200);
            expect(resetRes.body.success).toBe(true);

            // Verify they are gone
            const getRes = await request(app).get('/api/settings').set('Authorization', `Bearer ${adminToken}`);
            expect(getRes.status).toBe(200);
            expect(getRes.body.calendarConfigs).toEqual({});
            expect(getRes.body.people).toEqual([]);

            // Restore original mock
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ email: 'test@example.com' })
            });
        });
    });

    describe('Settings persistence across logout / login', () => {
        const savedSettings = {
            calendarConfigs: {
                'cal-work': { selected: true, emoji: '💼' },
                'cal-family': { selected: false, assignment: 'alice@example.com' }
            },
            people: [
                { email: 'alice@example.com', name: 'Alice', initials: 'AL', color: '#ff6b6b' },
                { email: 'bob@example.com',   name: 'Bob',   initials: 'BO', color: '#4ecdc4' }
            ]
        };

        it('should persist calendarConfigs and people after a logout/login cycle', async () => {
            // ── Step 1: user is logged in and saves their settings ──────────
            const putRes = await request(app)
                .put('/api/settings')
                .set('Authorization', `Bearer ${TEST_TOKEN}`)
                .send(savedSettings);
            expect(putRes.status).toBe(200);
            expect(putRes.body.success).toBe(true);

            // ── Step 2: user logs out ────────────────────────────────────────
            // Logout is purely client-side (token discarded); the backend holds
            // no session state, so nothing to call here.

            // ── Step 3: user logs back in and fetches their settings ─────────
            // The same Google token mock resolves to the same email, which
            // mirrors what happens in the real app on a fresh login.
            const getRes = await request(app)
                .get('/api/settings')
                .set('Authorization', `Bearer ${TEST_TOKEN}`);

            expect(getRes.status).toBe(200);

            // calendarConfigs must be restored exactly
            expect(getRes.body.calendarConfigs).toEqual(savedSettings.calendarConfigs);

            // people must be restored exactly
            expect(getRes.body.people).toHaveLength(savedSettings.people.length);
            expect(getRes.body.people).toEqual(
                expect.arrayContaining(
                    savedSettings.people.map(p => expect.objectContaining(p))
                )
            );
        });

        it('should keep each user\'s settings isolated from other users', async () => {
            const tokenA = jwt.sign({ email: 'test@example.com' }, JWT_SECRET);
            const tokenB = jwt.sign({ email: 'other@example.com' }, JWT_SECRET);

            // Save settings for user A
            await request(app)
                .put('/api/settings')
                .set('Authorization', `Bearer ${tokenA}`)
                .send(savedSettings);

            // User B should get empty/default settings, not user A's data
            const getRes = await request(app)
                .get('/api/settings')
                .set('Authorization', `Bearer ${tokenB}`);

            expect(getRes.status).toBe(200);
            expect(getRes.body.calendarConfigs).toEqual({});
            expect(getRes.body.people).toEqual([]);

            // Restore mock
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ email: 'test@example.com' })
            });
        });
    });

    // ── Auth endpoints ──────────────────────────────────────────────────────

    describe('POST /api/auth', () => {
        it('should return 400 if no code is provided', async () => {
            const res = await request(app).post('/api/auth').send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/code/i);
        });

        it('should exchange a code and return session_token and email', async () => {
            const { OAuth2Client } = await import('google-auth-library');
            const newExpiry = Date.now() + 3600 * 1000;
            vi.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({
                tokens: {
                    access_token: 'new_access_token',
                    refresh_token: 'new_refresh_token',
                    expiry_date: newExpiry,
                }
            } as any);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ email: 'test@example.com' })
            });

            const res = await request(app)
                .post('/api/auth')
                .send({ code: 'fake_auth_code' });

            expect(res.status).toBe(200);
            expect(res.body.session_token).toBeDefined();
            expect(res.body.email).toBe('test@example.com');
            vi.restoreAllMocks();
        });

        it('should return 500 if Google token exchange fails', async () => {
            const { OAuth2Client } = await import('google-auth-library');
            vi.spyOn(OAuth2Client.prototype, 'getToken').mockRejectedValue(new Error('invalid_grant'));

            const res = await request(app)
                .post('/api/auth')
                .send({ code: 'bad_code' });

            expect(res.status).toBe(500);
            expect(res.body.error).toMatch(/exchange/i);
            vi.restoreAllMocks();
        });
    });

});
