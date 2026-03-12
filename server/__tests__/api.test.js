/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { initializeDb, closeDb } from '../db.js';
import { unlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Backend API Tests', () => {
    beforeAll(async () => {
        // Initialize test DB table
        await initializeDb();
    });

    afterAll(async () => {
        try {
            await closeDb();
            await unlink(path.join(__dirname, '../database.test.sqlite'));
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
                .set('Authorization', 'Bearer fake_token');
            expect(res.status).toBe(200);
            expect(res.body.calendarConfigs).toEqual({});
            expect(res.body.people).toEqual([]);
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
                .set('Authorization', 'Bearer fake_token')
                .send(newSettings);

            expect(putRes.status).toBe(200);
            expect(putRes.body.success).toBe(true);

            const getRes = await request(app)
                .get('/api/settings')
                .set('Authorization', 'Bearer fake_token');

            expect(getRes.status).toBe(200);
            expect(getRes.body.calendarConfigs).toEqual(newSettings.calendarConfigs);
            expect(getRes.body.people).toEqual(newSettings.people);
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
            // "test@example.com" is set in the mock fetch at the top of the file
            const res = await request(app).post('/api/settings/reset').set('Authorization', 'Bearer fake_token');
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Only the admin can perform a full reset');
        });

        it('should clear all settings if user is admin', async () => {
            // Setup: add some settings
            const newSettings = {
                calendarConfigs: { 'testCal': { selected: true } },
                people: [{ id: '1', name: 'Bob' }]
            };
            await request(app).put('/api/settings').set('Authorization', 'Bearer fake_token').send(newSettings);

            // Change mock to return admin email
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ email: 'admin@example.com' })
            });

            // Execute reset
            const resetRes = await request(app).post('/api/settings/reset').set('Authorization', 'Bearer fake_token');
            expect(resetRes.status).toBe(200);
            expect(resetRes.body.success).toBe(true);

            // Verify they are gone
            const getRes = await request(app).get('/api/settings').set('Authorization', 'Bearer fake_token');
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
                .set('Authorization', 'Bearer fake_token')
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
                .set('Authorization', 'Bearer fake_token');

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
            // Save settings for user A (already mocked as test@example.com)
            await request(app)
                .put('/api/settings')
                .set('Authorization', 'Bearer token_a')
                .send(savedSettings);

            // Switch mock to a different user
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ email: 'other@example.com' })
            });

            // User B should get empty/default settings, not user A's data
            const getRes = await request(app)
                .get('/api/settings')
                .set('Authorization', 'Bearer token_b');

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

    describe('POST /api/auth/exchange', () => {
        it('should return 400 if no code is provided', async () => {
            const res = await request(app).post('/api/auth/exchange').send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/code/i);
        });

        it('should exchange a code and return access_token + expiry_date', async () => {
            const { OAuth2Client } = await import('google-auth-library');
            const newExpiry = Date.now() + 3600 * 1000;
            vi.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({
                tokens: {
                    access_token: 'new_access_token',
                    refresh_token: 'new_refresh_token',
                    expiry_date: newExpiry,
                }
            });
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ email: 'test@example.com' })
            });

            const res = await request(app)
                .post('/api/auth/exchange')
                .send({ code: 'fake_auth_code' });

            expect(res.status).toBe(200);
            expect(res.body.access_token).toBe('new_access_token');
            expect(res.body.expiry_date).toBeGreaterThan(Date.now());
            vi.restoreAllMocks();
        });

        it('should return 500 if Google token exchange fails', async () => {
            const { OAuth2Client } = await import('google-auth-library');
            vi.spyOn(OAuth2Client.prototype, 'getToken').mockRejectedValue(new Error('invalid_grant'));

            const res = await request(app)
                .post('/api/auth/exchange')
                .send({ code: 'bad_code' });

            expect(res.status).toBe(500);
            expect(res.body.error).toMatch(/exchange/i);
            vi.restoreAllMocks();
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('should return 401 if no Authorization header is present', async () => {
            const res = await request(app).post('/api/auth/refresh');
            expect(res.status).toBe(401);
        });

        it('should return 401 if no refresh token is stored for that user', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ email: 'norefresh@example.com' })
            });

            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', 'Bearer valid_token');

            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/refresh token/i);

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ email: 'test@example.com' })
            });
        });

        it('should return a new access_token when a valid refresh token is stored', async () => {
            const { OAuth2Client } = await import('google-auth-library');
            const newExpiry = Date.now() + 3600 * 1000;

            // First, seed a refresh token via exchange
            vi.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({
                tokens: {
                    access_token: 'original_access_token',
                    refresh_token: 'stored_refresh_token',
                    expiry_date: newExpiry,
                }
            });
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ email: 'refresh_user@example.com' })
            });
            await request(app).post('/api/auth/exchange').send({ code: 'valid_code' });

            // Now mock the refresh and call the endpoint
            vi.spyOn(OAuth2Client.prototype, 'refreshAccessToken').mockResolvedValue({
                credentials: {
                    access_token: 'refreshed_access_token',
                    expiry_date: Date.now() + 3600 * 1000,
                }
            });

            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', 'Bearer original_access_token');

            expect(res.status).toBe(200);
            expect(res.body.access_token).toBe('refreshed_access_token');
            expect(res.body.expiry_date).toBeGreaterThan(Date.now());
            vi.restoreAllMocks();
        });
    });
});


