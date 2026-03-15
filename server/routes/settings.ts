import express, { Response } from 'express';
import { authenticateSession, AuthenticatedRequest } from '../middleware/auth';
import { getUserSettings, saveUserSettings, clearAllUserSettings } from '../db';
import { CalendarConfig, Person } from '../../common/types';

const router = express.Router();

/**
 * GET /api/settings
 */
router.get('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'User not authenticated' });
        const userId = req.user.email;
        const adminEmail = process.env.ADMIN_EMAIL;
        const isAdmin = Boolean(adminEmail && userId === adminEmail);

        const settings = await getUserSettings(userId);
        const hasConfigs = settings?.calendarConfigs && Object.keys(settings.calendarConfigs).length > 0;
        const hasPeople = settings?.people && settings.people.length > 0;
        const isNewUser = !hasConfigs && !hasPeople;

        res.json({
            email: userId,
            calendarConfigs: settings?.calendarConfigs || {},
            people: settings?.people || [],
            isAdmin,
            isNewUser
        });
    } catch (error: unknown) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

/**
 * PUT /api/settings
 */
router.put('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'User not authenticated' });
        const userId = req.user.email;
        const { calendarConfigs, people } = req.body as { calendarConfigs: Record<string, CalendarConfig>; people: Person[] };
        await saveUserSettings(userId, calendarConfigs, people);
        res.json({ success: true });
    } catch (error: unknown) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

/**
 * POST /api/settings/reset
 */
router.post('/reset', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'User not authenticated' });
        const userEmail = req.user.email;
        const adminEmail = process.env.ADMIN_EMAIL;

        if (!adminEmail || userEmail !== adminEmail) {
            return res.status(403).json({ error: 'Only the admin can perform a full reset' });
        }

        await clearAllUserSettings();
        res.json({ success: true });
    } catch (error: unknown) {
        console.error('Error clearing all settings:', error);
        res.status(500).json({ error: 'Failed to clear all settings' });
    }
});

export default router;
