import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { saveUserTokens } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'postmessage'
);

/**
 * POST /api/auth
 * Receives a one-time Google auth code, exchanges it for tokens, and issues a local JWT.
 */
router.post('/', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Auth code is required' });

    try {
        const { tokens } = await oauth2Client.getToken(code);
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        
        if (!userInfoRes.ok) {
            return res.status(401).json({ error: 'Failed to identify user' });
        }
        
        const { email } = await userInfoRes.json();
        await saveUserTokens(email, tokens.access_token, tokens.refresh_token, tokens.expiry_date);

        const sessionToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ session_token: sessionToken, email });
    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({ error: 'Failed to exchange auth code' });
    }
});

export default router;
