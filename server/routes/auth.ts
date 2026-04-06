import express, { Response } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { saveUserTokens, getUserTokens } from '../db';
import { authenticateSession, optionalAuthenticateSession, AuthenticatedRequest } from '../middleware/auth';
import { AuthExchangeResponse } from '../../common/types';

const router = express.Router();
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'postmessage'
);

/**
 * @api {post} /api/auth Exchange Auth Code
 * @apiName ExchangeAuthCode
 * @apiGroup Auth
 *
 * @apiBody {String} code Google authorization code
 *
 * @apiSuccess {String} session_token Local session JWT
 * @apiSuccess {String} email User email address
 *
 * @apiError (400) {String} error Auth code is required
 * @apiError (401) {String} error Failed to identify user
 * @apiError (500) {String} error Failed to exchange auth code
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
        await saveUserTokens(email, tokens.access_token || null, tokens.refresh_token || null, tokens.expiry_date || null);

        const sessionToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
        const response: AuthExchangeResponse = { session_token: sessionToken, email };
        res.json(response);
    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({ error: 'Failed to exchange auth code' });
    }
});

/**
 * @api {get} /api/auth/status Check Current Authentication Status
 * @apiName AuthStatus
 * @apiGroup Auth
 *
 * Returns the current session info if authenticated via any method (JWT, Cloudflare).
 * Used by the frontend on mount to detect existing Cloudflare sessions.
 */
router.get('/status', optionalAuthenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
        return res.json({ session_token: null, email: null, hasRefreshToken: false });
    }
    
    const email = req.user.email;
    const tokens = await getUserTokens(email);
    const hasRefreshToken = !!tokens?.refreshToken;

    const sessionToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    const response = { 
        session_token: sessionToken, 
        email,
        hasRefreshToken
    };
    res.json(response);
});

export default router;
