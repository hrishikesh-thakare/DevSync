import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db } from '../../config/db.js';
import { users, refreshTokens, authTokens } from '../../db/schema/auth.js';
import { workspaceInvites, workspaceMembers } from '../../db/schema/workspaces.js';
import { env } from '../../config/env.js';
import { eq, and, isNull, gt, ne } from 'drizzle-orm';
import { supabase } from '../../config/supabase.js';
import { logAuditAction } from '../audit/audit.controller.js';
import { broadcastPresence } from '../../sockets/index.js';
import { enqueueJob } from '../../workers/queue.js';
import { createFileRecord, resolveDownloadUrl } from '../files/files.controller.js';

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

// ─── Auth tokens (password reset / email verification) ───────────────────────

const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;  // 30 minutes
const EMAIL_VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const createAuthToken = async (userId: string, type: 'password_reset' | 'email_verify', ttlMs: number): Promise<string> => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await db.insert(authTokens).values({
    userId,
    type,
    tokenHash,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return rawToken;
};

// In dev/test (no SMTP) the "email" is only logged; returning the link in the
// response keeps the full flow usable locally and testable in CI. Production
// never leaks the link — it only goes out via the email service.
const exposeLinkInResponse = (): boolean => env.NODE_ENV !== 'production';

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

    // Send email verification link
    const verificationToken = await createAuthToken(newUser.userId, 'email_verify', EMAIL_VERIFY_TOKEN_TTL_MS);
    enqueueJob('email.send_verification', { toEmail: newUser.email, verificationToken });

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
      verificationUrl: exposeLinkInResponse() ? `${env.FRONTEND_URL}/verify-email?token=${verificationToken}` : undefined,
    });
  } catch (err: any) {
    // Two concurrent registrations of the same email can both pass the
    // pre-check above; the unique constraint then rejects the second one.
    // Surface it as the same 409 the pre-check returns, not a 500.
    if (err?.code === '23505') {
      res.status(409).json({ error: 'A user with this email already exists.' });
      return;
    }
    console.error('Registration error:', err);
    res.status(500).json({ 
      error: 'Server error during registration.',
      details: env.NODE_ENV !== 'production' ? (err instanceof Error ? err.message : String(err)) : undefined
    });
  }
};

// ─── Per-account lockout ─────────────────────────────────────────────────────
// Complements the IP-based authLimiter: this catches slow/distributed credential
// stuffing against a single account, which the IP limiter cannot see. Always on;
// it only triggers after 5 consecutive failed attempts, so dev/e2e flows that
// log in correctly are unaffected.
const ACCOUNT_LOCKOUT_THRESHOLD = 5;          // failed attempts before lockout
const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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
    if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({
        error: `Account temporarily locked due to too many failed login attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const update: Record<string, any> = { failedLoginAttempts: nextAttempts };
      if (nextAttempts >= ACCOUNT_LOCKOUT_THRESHOLD) {
        update.lockoutUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS);
        update.failedLoginAttempts = 0;
      }
      await db.update(users).set(update).where(eq(users.userId, user.userId));
      await logAuditAction({ actorId: user.userId, action: 'user.login_failed', entityType: 'user', entityId: user.userId, newValues: { reason: 'invalid_password' } });
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Email verification enforcement: the password is right, but the account
    // must be verified before it can sign in (production default; the e2e
    // suite opts in so CI covers this path).
    if (env.REQUIRE_EMAIL_VERIFICATION && !user.emailVerifiedAt) {
      res.status(403).json({ error: 'Please verify your email before signing in. Check your inbox for the verification link.' });
      return;
    }

    // Success: clear any lockout state
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockoutUntil: null })
      .where(eq(users.userId, user.userId));

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

    // Supabase carries the GitHub handle as user_metadata.user_name. It was
    // available here all along and simply never read, which left users.github_login
    // NULL for everyone — and since matchAuthorUserId() looks a webhook author up
    // by that column, every PR, issue and branch ingested from GitHub was
    // attributed to nobody. Capturing it is what makes per-person GitHub
    // analytics resolve to real accounts.
    const provider = sbUser.app_metadata?.provider;
    const githubLogin =
      provider === 'github'
        ? sbUser.user_metadata?.user_name || sbUser.user_metadata?.preferred_username || null
        : null;

    if (!user) {
      // Auto-register the user if they don't exist
      isNewUser = true;
      const fullName = sbUser.user_metadata?.full_name || email.split('@')[0];
      const avatarUrl = sbUser.user_metadata?.avatar_url || null;

      await db.transaction(async (tx) => {
        const [newUser] = await tx
          .insert(users)
          .values({ email, fullName, avatarUrl, githubLogin, emailVerifiedAt: new Date() })
          .returning();

        user = newUser;

        await logAuditAction({
          actorId: user.userId, action: 'user.registered_via_github', entityType: 'user', entityId: user.userId,
          newValues: { email: user.email, full_name: user.fullName, auth_method: 'github' }, tx
        });
      });
    }

    // Backfill for accounts created before the handle was captured, so existing
    // users start resolving on their next GitHub sign-in rather than needing a
    // migration to guess at them.
    if (!isNewUser && githubLogin && user && !user.githubLogin) {
      await db.update(users).set({ githubLogin }).where(eq(users.userId, user.userId));
      user.githubLogin = githubLogin;
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

    await broadcastPresence(
      userId,
      updatedUser?.presence || 'online',
      updatedUser?.statusText || '',
    );
    
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
      
    await broadcastPresence(
      userId,
      updatedUser?.presence || 'online',
      updatedUser?.statusText || '',
    );
    
    res.json({ message: 'Presence updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Update presence error:', err);
    res.status(500).json({ error: 'Server error updating presence.' });
  }
};

// PATCH /auth/profile — currently just `avatarUrl`. `POST /auth/avatar`
// (below) is what actually uploads the image and returns the URL this
// expects; this endpoint only ever writes whatever URL it's handed, with no
// image processing or storage concern of its own.
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { avatarUrl } = req.body;

    await db.update(users)
      .set({ avatarUrl })
      .where(eq(users.userId, userId));

    res.json({ message: 'Profile updated successfully', avatarUrl });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error updating profile.' });
  }
};

// POST /auth/avatar — uploads the image and returns a durable URL, but does
// NOT write `users.avatarUrl` itself; `AccountSettingsPage` still calls
// `PATCH /auth/profile` with the URL this returns, same as when it uploaded
// straight to Supabase from the browser. Kept separate rather than folded
// into one endpoint that both stores the file and updates the row, so the
// one existing, already-tested profile-write path doesn't need to change.
//
// A dedicated endpoint, not `POST /workspaces/:slug/files/upload`, because
// an avatar has no workspace to be scoped under — that route sits behind
// `requireWorkspaceRole`, and `/account` is reachable with no workspace ever
// having been loaded. `createFileRecord` already supports `workspaceId: null`
// for exactly this (see its own doc comment); `resolveDownloadUrl(..., true)`
// generates the same ten-year signed URL chat attachments get, since an
// avatar is displayed indefinitely from a stored `<img src>`, never re-fetched.
export const uploadAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { filename, mimetype, sizeBytes, fileBase64 } = req.body;

    const fileRecord = await createFileRecord({
      workspaceId: null,
      userId,
      filename,
      mimetype,
      sizeBytes,
      filetype: 'image',
      fileBase64,
    });

    const avatarUrl = await resolveDownloadUrl(fileRecord, true);
    res.status(200).json({ avatarUrl });
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({ error: 'Server error uploading avatar.' });
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

// ─── Password & Email Recovery ───────────────────────────────────────────────

// POST /auth/change-password — change password while logged in; revokes every
// other session so a stolen credential dies with the old password.
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user?.passwordHash) {
      res.status(400).json({ error: 'This account uses Google/GitHub login. There is no password to change.' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash: newHash, failedLoginAttempts: 0, lockoutUntil: null })
        .where(eq(users.userId, userId));

      // Revoke every OTHER session (keep the one making this request)
      const currentHash = currentTokenHash(req);
      if (currentHash) {
        await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt), ne(refreshTokens.tokenHash, currentHash)));
      }

      await logAuditAction({ actorId: userId, action: 'user.password_changed', entityType: 'user', entityId: userId, tx });
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error changing password.' });
  }
};

// POST /auth/forgot-password — always 200 so the endpoint cannot be used to
// enumerate which emails have accounts.
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const normalized = email.toLowerCase().trim();

    const [user] = await db
      .select({ userId: users.userId, passwordHash: users.passwordHash, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);

    let resetToken: string | null = null;
    if (user && user.passwordHash && !user.deletedAt) {
      resetToken = await createAuthToken(user.userId, 'password_reset', PASSWORD_RESET_TOKEN_TTL_MS);
      enqueueJob('email.send_password_reset', { toEmail: normalized, resetToken });

      await logAuditAction({ actorId: user.userId, action: 'user.password_reset_requested', entityType: 'user', entityId: user.userId });
    }

    res.json({
      message: 'If an account exists for this email, a password reset link has been sent.',
      resetUrl: exposeLinkInResponse() && resetToken ? `${env.FRONTEND_URL}/reset-password?token=${resetToken}` : undefined,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error requesting password reset.' });
  }
};

// POST /auth/reset-password — complete the reset with the emailed token
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [record] = await db
      .select({
        tokenId: authTokens.tokenId,
        userId: authTokens.userId,
        expiresAt: authTokens.expiresAt,
        usedAt: authTokens.usedAt,
      })
      .from(authTokens)
      .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.type, 'password_reset')))
      .limit(1);

    if (!record || record.usedAt || new Date() > new Date(record.expiresAt)) {
      res.status(400).json({ error: 'Invalid or expired reset token.' });
      return;
    }

    const [user] = await db
      .select({ deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.userId, record.userId))
      .limit(1);

    if (!user || user.deletedAt) {
      res.status(400).json({ error: 'Invalid or expired reset token.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.transaction(async (tx) => {
      // Resetting via the emailed link proves ownership of the inbox, so the
      // email counts as verified from here on.
      await tx
        .update(users)
        .set({ passwordHash: newHash, failedLoginAttempts: 0, lockoutUntil: null, emailVerifiedAt: new Date() })
        .where(eq(users.userId, record.userId));

      // A successful reset signs every device out
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, record.userId), isNull(refreshTokens.revokedAt)));

      await tx
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(eq(authTokens.tokenId, record.tokenId));

      await logAuditAction({ actorId: record.userId, action: 'user.password_reset', entityType: 'user', entityId: record.userId, tx });
    });

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
};

// POST /auth/verify-email — confirm an email address with the emailed token
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [record] = await db
      .select({
        tokenId: authTokens.tokenId,
        userId: authTokens.userId,
        expiresAt: authTokens.expiresAt,
        usedAt: authTokens.usedAt,
      })
      .from(authTokens)
      .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.type, 'email_verify')))
      .limit(1);

    if (!record || record.usedAt || new Date() > new Date(record.expiresAt)) {
      res.status(400).json({ error: 'Invalid or expired verification token.' });
      return;
    }

    const [user] = await db
      .select({ deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.userId, record.userId))
      .limit(1);

    if (!user || user.deletedAt) {
      res.status(400).json({ error: 'Invalid or expired verification token.' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.userId, record.userId));

      await tx
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(eq(authTokens.tokenId, record.tokenId));

      await logAuditAction({ actorId: record.userId, action: 'user.email_verified', entityType: 'user', entityId: record.userId, tx });
    });

    res.json({ message: 'Email verified successfully.' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Server error verifying email.' });
  }
};

// DELETE /api/auth/me � soft delete the user's account
export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    await db.transaction(async (tx) => {
      // Soft delete the user
      await tx
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.userId, userId));

      // Revoke all active sessions
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));

      await logAuditAction({ actorId: userId, action: 'user.deleted', entityType: 'user', entityId: userId, tx });
    });

    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Server error deleting account.' });
  }
};
