import { Router } from 'express';
import { register, login, refresh, logout, oauthCallback, updateStatus, updatePresence, updatePreferences, listSessions, revokeSession, revokeOtherSessions } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { registerSchema, loginSchema } from './auth.schemas.js';

const router = Router();

// Public routes
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Supabase OAuth Callback
router.post('/oauth/callback', oauthCallback);

// Protected route to fetch logged in user details
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Protected routes for presence, status and preferences
router.post('/status', requireAuth, updateStatus);
router.post('/presence', requireAuth, updatePresence);
router.patch('/preferences', requireAuth, updatePreferences);

// Session / device management
router.get('/sessions', requireAuth, listSessions);
router.post('/sessions/revoke-others', requireAuth, revokeOtherSessions);
router.post('/sessions/:tokenId/revoke', requireAuth, revokeSession);

export default router;
