import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

/**
 * Middleware: authenticate local session via JWT.
 */
export async function authenticateSession(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('bearer '))) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { email: decoded.email };
        next();
    } catch (error) {
        console.error('Session authentication error:', error);
        res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }
}
