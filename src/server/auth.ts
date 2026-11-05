import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { query } from './db.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  nickname: string;
  profile_photo_url?: string;
  account_status: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  sessionId?: string;
}

const SESSION_COOKIE_NAME = 'ls_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Secure SHA-256 hashing for tokens (so plaintext tokens are never stored in DB)
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Password hashing with bcrypt (12 rounds)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate random cryptographic token
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

// Session cookie configuration helper: enforces sameSite: 'none' and secure: true in production for cross-site Cloudflare/Render deployment
export function getSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
}

// Create a new session and set the secure HTTP-only cookie
export async function createSession(userId: string, res: Response): Promise<string> {
  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await query(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at, created_at, last_used_at)
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [userId, tokenHash, expiresAt]
  );

  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    ...getSessionCookieOptions(),
    maxAge: SESSION_MAX_AGE_MS,
  });

  return rawToken;
}

// Revoke current session and clear cookie
export async function destroySession(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await query(
      `UPDATE auth_sessions 
       SET revoked_at = NOW() 
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );
  }

  res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
}

// Authentication middleware (strict: requires logged in user)
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];

  if (!rawToken || typeof rawToken !== 'string') {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const tokenHash = hashToken(rawToken);

  try {
    const result = await query(
      `SELECT s.id as session_id, s.user_id, u.email, u.nickname, u.profile_photo_url, u.account_status
       FROM auth_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = $1
         AND s.expires_at > NOW()
         AND s.revoked_at IS NULL
         AND u.account_status = 'active'
       LIMIT 1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      // Clear invalid cookie
      res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
      res.status(401).json({ error: 'Session expired or revoked. Please sign in again.' });
      return;
    }

    const row = result.rows[0];
    req.user = {
      id: row.user_id,
      email: row.email,
      nickname: row.nickname,
      profile_photo_url: row.profile_photo_url,
      account_status: row.account_status,
    };
    req.sessionId = row.session_id;

    // Asynchronously bump last_used_at without blocking request
    query(
      `UPDATE auth_sessions SET last_used_at = NOW() WHERE id = $1`,
      [row.session_id]
    ).catch(() => {});

    next();
  } catch (err: any) {
    console.error('[Auth Middleware Error]:', err.message || err);
    res.status(500).json({ error: 'Internal security authentication failure.' });
  }
}

// Optional Auth middleware (populates req.user if session cookie is present, but allows guests)
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];

  if (!rawToken || typeof rawToken !== 'string') {
    return next();
  }

  const tokenHash = hashToken(rawToken);

  try {
    const result = await query(
      `SELECT s.id as session_id, s.user_id, u.email, u.nickname, u.profile_photo_url, u.account_status
       FROM auth_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = $1
         AND s.expires_at > NOW()
         AND s.revoked_at IS NULL
         AND u.account_status = 'active'
       LIMIT 1`,
      [tokenHash]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      req.user = {
        id: row.user_id,
        email: row.email,
        nickname: row.nickname,
        profile_photo_url: row.profile_photo_url,
        account_status: row.account_status,
      };
      req.sessionId = row.session_id;
    }
  } catch (err) {
    // Non-fatal for optional auth
  }

  next();
}

// Simple in-memory rate limiter for auth endpoints (prevents brute-force)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function createRateLimiter(maxRequests = 10, windowMs = 15 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = user?.id ? `user_${user.id}` : `ip_${ip}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      res.status(429).json({
        error: `Too many attempts. Please try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`,
      });
      return;
    }

    entry.count++;
    next();
  };
}
