import express, { Response } from "express";
import { authenticateSession, AuthenticatedRequest } from "../middleware/auth";
import { getUserSettings, saveUserSettings, clearAllUserSettings } from "../db";
import {
  CalendarConfig,
  Person,
  SuccessResponse,
  UserSettingsResponse,
  Appearance,
} from "../../common/types";

const router = express.Router();

/**
 * @api {get} /api/settings Fetch User Settings
 * @apiName GetSettings
 * @apiGroup Settings
 * @apiPermission session
 *
 * @apiSuccess {String} email User's primary email address
 * @apiSuccess {Object} calendarConfigs Map of calendar IDs to configurations
 * @apiSuccess {Object[]} people List of discovered/managed people
 * @apiSuccess {Boolean} isAdmin Whether the user has admin privileges
 * @apiSuccess {Boolean} isNewUser Whether this is a first-time user profile
 *
 * @apiError (401) {String} error User not authenticated
 * @apiError (500) {String} error Failed to fetch settings
 */
router.get(
  "/",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user)
        return res.status(401).json({ error: "User not authenticated" });
      const userId = req.user.email;
      const adminEmail = process.env.ADMIN_EMAIL;
      const isAdmin = Boolean(adminEmail && userId === adminEmail);

      const settings = await getUserSettings(userId);
      const hasConfigs =
        settings?.calendarConfigs &&
        Object.keys(settings.calendarConfigs).length > 0;
      const hasPeople = settings?.people && settings.people.length > 0;
      const isNewUser = !hasConfigs && !hasPeople;

      const response: UserSettingsResponse = {
        email: userId,
        appearance: settings?.appearance || { theme: 'light' },
        calendarConfigs: settings?.calendarConfigs || {},
        people: settings?.people || [],
        isAdmin,
        isNewUser,
      };
      res.json(response);
    } catch (error: unknown) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  },
);

/**
 * @api {put} /api/settings Save User Settings
 * @apiName SaveSettings
 * @apiGroup Settings
 * @apiPermission session
 *
 * @apiBody {Object} calendarConfigs Map of calendar IDs to configurations
 * @apiBody {Object[]} people List of people to save
 *
 * @apiSuccess {Boolean} success Operation success indicator
 *
 * @apiError (401) {String} error User not authenticated
 * @apiError (500) {String} error Failed to save settings
 */
router.put(
  "/",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user)
        return res.status(401).json({ error: "User not authenticated" });
      const userId = req.user.email;
      const { calendarConfigs, people, appearance } = req.body as {
        calendarConfigs: Record<string, CalendarConfig>;
        people: Person[];
        appearance: Appearance;
      };
      await saveUserSettings(userId, calendarConfigs, people, appearance);
      const response: SuccessResponse = { success: true };
      res.json(response);
    } catch (error: unknown) {
      console.error("Error saving settings:", error);
      res.status(500).json({ error: "Failed to save settings" });
    }
  },
);

/**
 * @api {post} /api/settings/reset Full Factory Reset
 * @apiName ResetSettings
 * @apiGroup Settings
 * @apiPermission admin
 * @apiDescription Clears all user configurations (calendars and people) across the platform. Requires admin email.
 *
 * @apiSuccess {Boolean} success Operation success indicator
 *
 * @apiError (401) {String} error User not authenticated
 * @apiError (403) {String} error Only the admin can perform a full reset
 * @apiError (500) {String} error Failed to clear all settings
 */
router.post(
  "/reset",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user)
        return res.status(401).json({ error: "User not authenticated" });
      const userEmail = req.user.email;
      const adminEmail = process.env.ADMIN_EMAIL;

      if (!adminEmail || userEmail !== adminEmail) {
        return res
          .status(403)
          .json({ error: "Only the admin can perform a full reset" });
      }

      await clearAllUserSettings();
      const response: SuccessResponse = { success: true };
      res.json(response);
    } catch (error: unknown) {
      console.error("Error clearing all settings:", error);
      res.status(500).json({ error: "Failed to clear all settings" });
    }
  },
);

export default router;
