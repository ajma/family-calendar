import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../types';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

export type { AuthenticatedRequest };

interface JwtSessionPayload {
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Core logic to extract user from headers (JWT or Cloudflare).
 * Returns true if user was successfully identified and attached to req.user.
 */
async function identifyUser(req: AuthenticatedRequest): Promise<boolean> {
    // 1. Try local Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer '))) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as JwtSessionPayload;
            req.user = { email: decoded.email };
            return true;
        } catch (error: any) {
            // If local token is expired/invalid but Cloudflare headers are present, we'll try those below.
            // Only log if no other headers are present to avoid noise.
            if (!req.headers['cf-access-jwt-assertion'] && !req.headers['cf-access-authenticated-user-email']) {
                console.warn('Invalid local session JWT:', error.message);
            }
        }
    }

    // 2. Try Cloudflare Access headers (JWT assertion or user email)
    if (process.env.DISABLE_CLOUDFLARE_AUTH === 'true') {
        return false;
    }

    const cfEmail = req.headers['cf-access-authenticated-user-email'] as string;

    // Trust only the cf-access-authenticated-user-email header set by Cloudflare
    // after it verifies the JWT at the edge. We don't verify the JWT ourselves
    // since we'd need Cloudflare's public keys, and the header is sufficient
    // when traffic is routed through Cloudflare Access.
    if (cfEmail) {
        req.user = { email: cfEmail };
        return true;
    }
    
    return false;
}

/**
 * Middleware: authenticate local session via JWT or Cloudflare Access headers.
 * Returns 401 if authentication fails.
 */
export async function authenticateSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (await identifyUser(req)) {
        return next();
    }
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
}

/**
 * Middleware: try to authenticate but don't fail if no user is found.
 * req.user will be undefined if not authenticated.
 */
export async function optionalAuthenticateSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    await identifyUser(req);
    next();
}
