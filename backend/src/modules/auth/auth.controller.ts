import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db } from '../../config/db.js';
import { users, refreshTokens } from '../../db/schema/auth.js';
import { workspaceInvites, workspaceMembers } from '../../db/schema/workspaces.js';
import { env } from '../../config/env.js';
import { eq, and, isNull, gt, ne } from 'drizzle-orm';
import { supabase } from '../../config/supabase.js';
import { logAuditAction } from '../audit/audit.controller.js';
import { getIO } from '../../sockets/index.js';

// ─── Token Helpers ───────────────────────────────────────────────────────────

const generateAccessToken = (user: { userId: string; email: string }) => {
  return jwt.sign(
    { userId: user.userId, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );
};

const createRefreshToken = async (userId: string, req: Request): Promise<string> => {
  // Generate random token
  const rawToken = crypto.randomBytes(40).toString('hex');
  // Hash token for database storage
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiresInDays = parseInt(env.REFRESH_TOKEN_EXPIRES_IN) || 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const deviceInfo = {
    userAgent: req.headers['user-agent'] || 'unknown',
    ip: req.ip || 'unknown',
  };

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    deviceInfo,
    expiresAt,
  });

  return rawToken;
};

// ─── Route Handlers ──────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, displayName } = req.body;

    // Check if email already exists
    const [existingUser] = await db
      .select({ userId: users.userId })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existingUser) {
      res.status(400).json({ error: 'A user with this email already exists.' });
      return;
    }

    let inviteRecord = null;
    if (req.body.inviteToken) {
      const [invite] = await db.select().from(workspaceInvites).where(eq(workspaceInvites.token, req.body.inviteToken)).limit(1);
      if (!invite || new Date() > new Date(invite.expiresAt) || invite.email.toLowerCase() !== email.toLowerCase().trim()) {
        res.status(400).json({ error: 'Invalid or expired invite token, or email mismatch.' });
        return;
      }
      inviteRecord = invite;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName: fullName.trim(),
          displayName: displayName ? displayName.trim() : null,
        })
        .returning({
          userId: users.userId,
          email: users.email,
          fullName: users.fullName,
          displayName: users.displayName,
        });

      await logAuditAction({
        actorId: u.userId, action: 'user.registered', entityType: 'user', entityId: u.userId,
        newValues: { email: u.email, full_name: u.fullName, auth_method: 'email' }, tx
      });

      if (inviteRecord) {
        await tx.insert(workspaceMembers).values({
          workspaceId: inviteRecord.workspaceId,
          userId: u.userId,
          role: inviteRecord.role,
          invitedBy: inviteRecord.invitedBy,
          state: 'active',
        });
        await tx.delete(workspaceInvites).where(eq(workspaceInvites.inviteId, inviteRecord.inviteId));
        await logAuditAction({
          actorId: u.userId, action: 'workspace_member.invite_accepted', entityType: 'workspace_member', entityId: u.userId, workspaceId: inviteRecord.workspaceId ?? undefined,
          newValues: { state: 'active' }, oldValues: { state: 'invited' }, tx
        });
      }

      return u;
    });

    // Generate tokens
    const accessToken = generateAccessToken(newUser);
    const refreshToken = await createRefreshToken(newUser.userId, req);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'Registration successful',
      accessToken,
      user: newUser,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
};

// ─── Per-account lockout (production only) ───────────────────────────────────
// Complements the IP-based authLimiter: this catches slow/distributed credential
// stuffing against a single account, which the IP limiter cannot see. Disabled
// outside production so e2e tests and local dev never hit a lockout.
const ACCOUNT_LOCKOUT_THRESHOLD = 5;          // failed attempts before lockout
const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const isLockoutEnabled = () => env.NODE_ENV === 'production';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || user.deletedAt) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Check password (if user signed up via OAuth, passwordHash might be null)
    if (!user.passwordHash) {
      res.status(400).json({
        error: 'This account uses Google/GitHub login. Please sign in using OAuth.',
      });
      return;
    }

    // Per-account lockout: reject before the expensive bcrypt compare
    if (isLockoutEnabled() && user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({
        error: `Account temporarily locked due to too many failed login attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      if (isLockoutEnabled()) {
        const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
        const update: Record<string, any> = { failedLoginAttempts: nextAttempts };
        if (nextAttempts >= ACCOUNT_LOCKOUT_THRESHOLD) {
          update.lockoutUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS);
          update.failedLoginAttempts = 0;
        }
        await db.update(users).set(update).where(eq(users.userId, user.userId));
      }
      await logAuditAction({ actorId: user.userId, action: 'user.login_failed', entityType: 'user', entityId: user.userId, newValues: { reason: 'invalid_password' } });
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Success: clear any lockout state
    if (isLockoutEnabled()) {
      await db
        .update(users)
        .set({ failedLoginAttempts: 0, lockoutUntil: null })
        .where(eq(users.userId, user.userId));
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await createRefreshToken(user.userId, req);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Update presence
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ presence: 'online', lastActiveAt: new Date() })
        .where(eq(users.userId, user.userId));

      await logAuditAction({ actorId: user.userId, action: 'user.login', entityType: 'user', entityId: user.userId, newValues: { method: 'email', ip: req.ip || 'unknown' }, tx });
    });

    res.json({
      message: 'Login successful',
      accessToken,
      user: {
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        presence: 'online',
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;

    if (!token) {
      res.status(401).json({ error: 'Refresh token is required.' });
      return;
    }

    // Hash incoming token to match database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Query active refresh token with user details
    const [tokenRecord] = await db
      .select({
        tokenId: refreshTokens.tokenId,
        userId: refreshTokens.userId,
        expiresAt: refreshTokens.expiresAt,
        revokedAt: refreshTokens.revokedAt,
        user: {
          userId: users.userId,
          email: users.email,
          fullName: users.fullName,
          deletedAt: users.deletedAt,
        },
      })
      .from(refreshTokens)
      .innerJoin(users, eq(refreshTokens.userId, users.userId))
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.user.deletedAt) {
      res.status(401).json({ error: 'Invalid or revoked refresh token.' });
      return;
    }

    if (new Date() > new Date(tokenRecord.expiresAt)) {
      res.status(401).json({ error: 'Refresh token has expired.' });
      return;
    }

    // Rotate token: Revoke the old token
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenId, tokenRecord.tokenId));

    // Generate new Access and Refresh tokens
    const accessToken = generateAccessToken(tokenRecord.user);
    const newRefreshToken = await createRefreshToken(tokenRecord.user.userId, req);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      user: {
        userId: tokenRecord.user.userId,
        email: tokenRecord.user.email,
        fullName: tokenRecord.user.fullName,
      },
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ error: 'Server error processing token refresh.' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;

    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Revoke token in DB
      const [revoked] = await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .returning({ userId: refreshTokens.userId });

      if (revoked && revoked.userId) {
        const userId = revoked.userId;
        // Set presence to offline
        await db.transaction(async (tx) => {
          await tx
            .update(users)
            .set({ presence: 'offline', lastActiveAt: new Date() })
            .where(eq(users.userId, userId));

          await logAuditAction({ actorId: userId, action: 'user.logout', entityType: 'user', entityId: userId, tx });
        });
      }
    }

    // Clear client-side cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Server error during logout.' });
  }
};

export const oauthCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerToken } = req.body;

    if (!providerToken) {
      res.status(400).json({ error: 'Provider token is required.' });
      return;
    }

    // Use Supabase to verify the token and get the user
    // In a typical setup, the frontend sends the supabase access_token it received from the OAuth redirect
    const { data: { user: sbUser }, error } = await supabase.auth.getUser(providerToken);

    if (error || !sbUser) {
      res.status(401).json({ error: 'Invalid OAuth token.' });
      return;
    }

    const email = sbUser.email?.toLowerCase().trim();
    if (!email) {
      res.status(400).json({ error: 'Email not provided by OAuth provider.' });
      return;
    }

    // Find if user already exists in our Drizzle DB
    let isNewUser = false;
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      // Auto-register the user if they don't exist
      isNewUser = true;
      const fullName = sbUser.user_metadata?.full_name || email.split('@')[0];
      const avatarUrl = sbUser.user_metadata?.avatar_url || null;

      await db.transaction(async (tx) => {
        const [newUser] = await tx
          .insert(users)
          .values({ email, fullName, avatarUrl })
          .returning();
        
        user = newUser;

        await logAuditAction({
          actorId: user.userId, action: 'user.registered_via_github', entityType: 'user', entityId: user.userId,
          newValues: { email: user.email, full_name: user.fullName, auth_method: 'github' }, tx
        });
      });
    }

    if (user.deletedAt) {
      res.status(401).json({ error: 'This account has been deactivated.' });
      return;
    }

    // Generate our custom tokens to establish the session
    const accessToken = generateAccessToken(user);
    const refreshToken = await createRefreshToken(user.userId, req);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Update presence
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ presence: 'online', lastActiveAt: new Date() })
        .where(eq(users.userId, user.userId));

      if (!isNewUser) {
        await logAuditAction({ actorId: user.userId, action: 'user.login', entityType: 'user', entityId: user.userId, newValues: { method: 'github', ip: req.ip || 'unknown' }, tx });
      }
    });

    res.json({
      message: 'OAuth Login successful',
      accessToken,
      user: {
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        presence: 'online',
      },
    });
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    res.status(500).json({ error: 'Server error during OAuth processing.' });
  }
};

// ─── Session / Device Management ─────────────────────────────────────────────

const currentTokenHash = (req: Request): string | null => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken || null;
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
};

// GET /auth/sessions — list the user's active sessions
export const listSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const currentHash = currentTokenHash(req);

    const sessions = await db
      .select({
        tokenId: refreshTokens.tokenId,
        deviceInfo: refreshTokens.deviceInfo,
        issuedAt: refreshTokens.issuedAt,
        expiresAt: refreshTokens.expiresAt,
        tokenHash: refreshTokens.tokenHash,
      })
      .from(refreshTokens)
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())))
      .orderBy(refreshTokens.issuedAt);

    res.json({
      sessions: sessions.map((s) => ({
        tokenId: s.tokenId,
        deviceInfo: s.deviceInfo,
        issuedAt: s.issuedAt,
        expiresAt: s.expiresAt,
        isCurrent: currentHash !== null && s.tokenHash === currentHash,
      })),
    });
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: 'Server error listing sessions.' });
  }
};

// POST /auth/sessions/:tokenId/revoke — log out one device
export const revokeSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { tokenId } = req.params as Record<string, string>;

    const [token] = await db
      .select({ tokenId: refreshTokens.tokenId })
      .from(refreshTokens)
      .where(and(eq(refreshTokens.tokenId, tokenId), eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
      .limit(1);

    if (!token) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenId, tokenId));

    await logAuditAction({ actorId: userId, action: 'user.session_revoked', entityType: 'user', entityId: userId, newValues: { token_id: tokenId } });

    res.json({ message: 'Session revoked.' });
  } catch (err) {
    console.error('Revoke session error:', err);
    res.status(500).json({ error: 'Server error revoking session.' });
  }
};

// POST /auth/sessions/revoke-others — log out every other device
export const revokeOtherSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const currentHash = currentTokenHash(req);

    const where = and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt));
    if (currentHash) {
      // Revoke every session EXCEPT the one used for this request.
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(where, ne(refreshTokens.tokenHash, currentHash)));
    }

    await logAuditAction({ actorId: userId, action: 'user.sessions_revoked_others', entityType: 'user', entityId: userId });

    res.json({ message: 'All other sessions revoked.' });
  } catch (err) {
    console.error('Revoke other sessions error:', err);
    res.status(500).json({ error: 'Server error revoking sessions.' });
  }
};

// ─── Status & Presence Handlers ──────────────────────────────────────────────

export const updateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { statusText, presence } = req.body;
    
    const updateData: Record<string, any> = { lastActiveAt: new Date() };
    if (statusText !== undefined) updateData.statusText = statusText;
    if (presence !== undefined) updateData.presence = presence;

    await db.update(users)
      .set(updateData)
      .where(eq(users.userId, userId));
      
    // Fetch updated user state to broadcast full state
    const [updatedUser] = await db.select({
      presence: users.presence,
      statusText: users.statusText
    }).from(users).where(eq(users.userId, userId)).limit(1);

    const io = getIO();
    io.emit('user_presence_updated', { 
      userId, 
      presence: updatedUser?.presence || 'online', 
      statusText: updatedUser?.statusText || '' 
    });
    
    res.json({ message: 'Status updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Server error updating status.' });
  }
};

export const updatePresence = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { presence } = req.body;
    
    await db.update(users)
      .set({ presence, lastActiveAt: new Date() })
      .where(eq(users.userId, userId));

    const [updatedUser] = await db.select({
      presence: users.presence,
      statusText: users.statusText
    }).from(users).where(eq(users.userId, userId)).limit(1);
      
    const io = getIO();
    io.emit('user_presence_updated', { 
      userId, 
      presence: updatedUser?.presence || 'online', 
      statusText: updatedUser?.statusText || '' 
    });
    
    res.json({ message: 'Presence updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Update presence error:', err);
    res.status(500).json({ error: 'Server error updating presence.' });
  }
};

export const updatePreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { preferences } = req.body;
    
    const [currentUser] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.userId, userId));
    const currentPrefs = currentUser?.preferences || {};
    const newPrefs = { ...(currentPrefs as object), ...preferences };
    
    await db.update(users)
      .set({ preferences: newPrefs })
      .where(eq(users.userId, userId));

    res.json({ message: 'Preferences updated successfully', preferences: newPrefs });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Server error updating preferences.' });
  }
};

