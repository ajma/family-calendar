import express from 'express';
import { authenticateSession } from '../middleware/auth.js';
import { getUserSettings, saveUserSettings, clearAllUserSettings } from '../db.js';

const router = express.Router();

/**
 * GET /api/settings
 */
router.get('/', authenticateSession, async (req, res) => {
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

/**
 * PUT /api/settings
 */
router.put('/', authenticateSession, async (req, res) => {
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

/**
 * POST /api/settings/reset
 */
router.post('/reset', authenticateSession, async (req, res) => {
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

export default router;
