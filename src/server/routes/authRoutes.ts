import { Router, Response } from 'express';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  requireAuth,
  AuthenticatedRequest,
  createRateLimiter,
  generateRandomToken,
  hashToken,
} from '../auth.js';
import { query } from '../db.js';

const router = Router();

// Rate limit registration and login: 10 attempts per 15 minutes per IP
const authLimiter = createRateLimiter(10, 15 * 60 * 1000);

// Helper to fetch user settings
async function getUserSettings(userId: string) {
  const result = await query(
    `SELECT character_preference, timezone, preferences, updated_at
     FROM user_settings
     WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length > 0) {
    return result.rows[0];
  }
  return {
    character_preference: 'girl',
    timezone: 'UTC',
    preferences: {},
  };
}

// ============================================================================
// 1. POST /api/auth/register
// ============================================================================
router.post('/register', authLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password, nickname, avatar } = req.body;

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanNickname = typeof nickname === 'string' && nickname.trim()
      ? nickname.trim()
      : cleanEmail.split('@')[0];
    const profilePhoto = typeof avatar === 'string' && avatar.trim() ? avatar.trim() : '🎓';

    // Enforce case-insensitive uniqueness check
    const existing = await query(
      'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
      return;
    }

    const passwordHash = await hashPassword(password);

    // Insert user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, nickname, profile_photo_url, account_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
       RETURNING id, email, nickname, profile_photo_url, created_at, account_status`,
      [cleanEmail, passwordHash, cleanNickname, profilePhoto]
    );

    const newUser = userResult.rows[0];

    // Initialize default user_settings
    await query(
      `INSERT INTO user_settings (user_id, character_preference, timezone, preferences, updated_at)
       VALUES ($1, 'girl', 'UTC', '{}'::jsonb, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id]
    );

    // Create session & set HttpOnly cookie
    await createSession(newUser.id, res);

    const settings = await getUserSettings(newUser.id);

    res.status(201).json({
      message: 'Account created successfully.',
      user: {
        id: newUser.id,
        email: newUser.email,
        nickname: newUser.nickname,
        avatar: newUser.profile_photo_url,
        createdAt: newUser.created_at,
      },
      settings,
    });
  } catch (err: any) {
    console.error('[Register Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// ============================================================================
// 2. POST /api/auth/login
// ============================================================================
router.post('/login', authLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Please provide both email and password.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // Query user by lower-cased email
    const result = await query(
      `SELECT id, email, password_hash, nickname, profile_photo_url, account_status, created_at
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user = result.rows[0];

    if (user.account_status !== 'active') {
      res.status(403).json({ error: 'This account has been deactivated. Please contact support.' });
      return;
    }

    const isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Create session & set HttpOnly cookie
    await createSession(user.id, res);

    const settings = await getUserSettings(user.id);

    res.json({
      message: 'Signed in successfully.',
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.profile_photo_url,
        createdAt: user.created_at,
      },
      settings,
    });
  } catch (err: any) {
    console.error('[Login Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to sign in. Please try again.' });
  }
});

// ============================================================================
// 3. POST /api/auth/logout
// ============================================================================
router.post('/logout', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await destroySession(req, res);
    res.json({ message: 'Signed out successfully.' });
  } catch (err: any) {
    console.error('[Logout Error]:', err.message || err);
    res.status(500).json({ error: 'Logout encounter an unexpected error.' });
  }
});

// ============================================================================
// 4. GET /api/auth/me (Current Authenticated User)
// ============================================================================
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const userRes = await query(
      `SELECT id, email, nickname, profile_photo_url, email_verified_at, created_at
       FROM users
       WHERE id = $1 AND account_status = 'active'`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    const user = userRes.rows[0];
    const settings = await getUserSettings(userId);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.profile_photo_url,
        emailVerifiedAt: user.email_verified_at,
        createdAt: user.created_at,
      },
      settings,
    });
  } catch (err: any) {
    console.error('[Me Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to fetch current user session.' });
  }
});

// ============================================================================
// 5. PUT /api/auth/profile
// ============================================================================
router.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { nickname } = req.body;
    const avatarVal = req.body.avatar || req.body.profilePhotoUrl;

    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let idx = 1;

    if (typeof nickname === 'string' && nickname.trim()) {
      updates.push(`nickname = $${idx++}`);
      values.push(nickname.trim());
    }

    if (typeof avatarVal === 'string' && avatarVal.trim()) {
      updates.push(`profile_photo_url = $${idx++}`);
      values.push(avatarVal.trim());
    }

    values.push(userId);
    const queryStr = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING id, email, nickname, profile_photo_url, created_at
    `;

    const result = await query(queryStr, values);
    const updated = result.rows[0];

    res.json({
      message: 'Profile updated successfully.',
      user: {
        id: updated.id,
        email: updated.email,
        nickname: updated.nickname,
        avatar: updated.profile_photo_url,
        createdAt: updated.created_at,
      },
    });
  } catch (err: any) {
    console.error('[Profile Update Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

// ============================================================================
// 6. POST /api/auth/forgot-password
// ============================================================================
router.post('/forgot-password', authLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRes = await query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);

    // Anti-enumeration: Always return 200 even if user doesn't exist
    if (userRes.rows.length === 0) {
      res.json({
        message: 'If an account exists with this email, a reset token has been registered.',
      });
      return;
    }

    const userId = userRes.rows[0].id;
    const rawResetToken = generateRandomToken(32);
    const tokenHash = hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userId, tokenHash, expiresAt]
    );

    res.json({
      message: 'If an account exists with this email, a reset token has been registered.',
      // In development mode only, provide token directly for ease of testing
      ...(process.env.NODE_ENV !== 'production' ? { devResetToken: rawResetToken } : {}),
    });
  } catch (err: any) {
    console.error('[Forgot Password Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// ============================================================================
// 7. POST /api/auth/reset-password
// ============================================================================
router.post('/reset-password', authLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Invalid or missing reset token.' });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const tokenHash = hashToken(token.trim());

    const tokenRes = await query(
      `SELECT id, user_id, expires_at, consumed_at
       FROM password_reset_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired password reset token.' });
      return;
    }

    const resetRecord = tokenRes.rows[0];

    if (resetRecord.consumed_at || new Date(resetRecord.expires_at) < new Date()) {
      res.status(400).json({ error: 'This password reset token has already been used or has expired.' });
      return;
    }

    const newHash = await hashPassword(newPassword);

    // Update password
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      newHash,
      resetRecord.user_id,
    ]);

    // Mark token as consumed
    await query('UPDATE password_reset_tokens SET consumed_at = NOW() WHERE id = $1', [
      resetRecord.id,
    ]);

    // Invalidate all existing sessions for this user for security
    await query(
      'UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [resetRecord.user_id]
    );

    res.json({ message: 'Password has been reset successfully. Please sign in with your new password.' });
  } catch (err: any) {
    console.error('[Reset Password Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// ============================================================================
// 8. GET & PUT /api/user/settings
// ============================================================================
router.get('/settings', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const settings = await getUserSettings(req.user!.id);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch user settings.' });
  }
});

router.put('/settings', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { characterPreference, timezone, preferences } = req.body;

    const charPref = characterPreference === 'boy' ? 'boy' : 'girl';
    const tz = typeof timezone === 'string' ? timezone : 'UTC';
    const prefsJson = typeof preferences === 'object' && preferences !== null ? JSON.stringify(preferences) : '{}';

    const result = await query(
      `INSERT INTO user_settings (user_id, character_preference, timezone, preferences, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         character_preference = EXCLUDED.character_preference,
         timezone = EXCLUDED.timezone,
         preferences = EXCLUDED.preferences,
         updated_at = NOW()
       RETURNING character_preference, timezone, preferences, updated_at`,
      [userId, charPref, tz, prefsJson]
    );

    res.json({
      message: 'Settings updated successfully.',
      settings: result.rows[0],
    });
  } catch (err: any) {
    console.error('[Settings Update Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to update user settings.' });
  }
});

export default router;
