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
});
