import { Router } from 'express';
import { register, login, refresh, logout, oauthCallback, updateStatus, updatePresence, updatePreferences } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
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

export default router;
