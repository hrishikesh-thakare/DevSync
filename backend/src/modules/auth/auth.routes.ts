import { Router } from 'express';
import { register, login, refresh, logout, oauthCallback, updateStatus, updatePresence, updatePreferences, listSessions, revokeSession, revokeOtherSessions, changePassword, forgotPassword, resetPassword, verifyEmail, deleteAccount } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, updateStatusSchema, updatePresenceSchema } from './auth.schemas.js';

const router = Router();

// Public routes
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Password recovery & email verification
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), verifyEmail);

// Supabase OAuth Callback
router.post('/oauth/callback', oauthCallback);

// Protected route to fetch logged in user details
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
router.delete('/me', requireAuth, deleteAccount);

// Protected routes for presence, status and preferences
router.post('/status', requireAuth, validate(updateStatusSchema), updateStatus);
router.post('/presence', requireAuth, validate(updatePresenceSchema), updatePresence);
router.patch('/preferences', requireAuth, updatePreferences);
router.post('/change-password', requireAuth, validate(changePasswordSchema), changePassword);

// Session / device management
router.get('/sessions', requireAuth, listSessions);
router.post('/sessions/revoke-others', requireAuth, revokeOtherSessions);
router.post('/sessions/:tokenId/revoke', requireAuth, revokeSession);

export default router;
