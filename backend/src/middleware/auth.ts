import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../config/db.js';
import { users } from '../db/schema/auth.js';
import { eq } from 'drizzle-orm';

// Extend Express Request interface to store user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        fullName: string;
      };
    }
  }
}

interface JWTPayload {
  userId: string;
  email: string;
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Provide a Bearer token.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    // Every token this app issues is signed HS256 (jsonwebtoken's default).
    // Pinning it here means a token whose header claims a different
    // algorithm is rejected outright, rather than `verify` picking whatever
    // algorithm the token itself names.
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JWTPayload;

    // Fetch user from DB to verify they still exist and are active (not deleted)
    const [user] = await db
      .select({
        userId: users.userId,
        email: users.email,
        fullName: users.fullName,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.userId, decoded.userId))
      .limit(1);

    if (!user || user.deletedAt) {
      res.status(401).json({ error: 'User no longer exists or is deactivated.' });
      return;
    }

    // Attach user information to request
    req.user = {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ error: 'Invalid authentication token.' });
  }
};
