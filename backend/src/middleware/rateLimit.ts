import rateLimit from 'express-rate-limit';

// Skip rate limiting in test and development environments so tests,
// seed scripts, and local auth loops never get blocked with 429s.
const shouldSkip = () => {
  return process.env.NODE_ENV !== 'production' || process.env.DISABLE_RATE_LIMIT === 'true';
};

// Global rate limiter applied to all routes
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000, // Limit each IP to 1000 requests per `window` (here, per 15 minutes).
  skip: shouldSkip,
  standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
});

// Stricter rate limiter specifically for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // Limit each IP to 10 requests per `window` (here, per 15 minutes).
  skip: shouldSkip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts from this IP, please try again after 15 minutes' },
});

// The unfurler makes the server fetch a URL the caller chose. `assertPublicHttpUrl`
// stops it reaching anything private, but an unlimited outbound-fetch endpoint is
// still an amplifier — worth capping even for authenticated members.
export const unfurlLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  skip: shouldSkip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many link previews requested, please slow down' },
});
