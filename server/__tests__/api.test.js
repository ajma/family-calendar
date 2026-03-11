/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { initializeDb } from '../db.js';
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
});
