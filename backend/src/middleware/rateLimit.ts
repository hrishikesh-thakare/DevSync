import rateLimit from 'express-rate-limit';

// Skip all rate limiting in the test environment so the seed script and
// Playwright global-setup can authenticate without triggering 429s.
const isTest = process.env.NODE_ENV === 'test';

// Global rate limiter applied to all routes
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000, // Limit each IP to 1000 requests per `window` (here, per 15 minutes).
  skip: () => isTest,
  standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
});

// Stricter rate limiter specifically for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // Limit each IP to 10 requests per `window` (here, per 15 minutes).
  skip: () => isTest,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts from this IP, please try again after 15 minutes' },
});
