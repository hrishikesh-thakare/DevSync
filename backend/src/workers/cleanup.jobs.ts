import { lt, or, and, isNotNull } from 'drizzle-orm';
import { db } from '../config/db.js';
import { refreshTokens, authTokens } from '../db/schema/auth.js';

/**
 * Expired-credential sweep.
 *
 * `refresh_tokens` gains a row on every login and every refresh — with a
 * 15-minute access token that is roughly 96 rows per active user per day — and
 * `auth_tokens` gains one per password reset and per verification email.
 * Nothing ever deleted them. Both tables grow without bound, the unique index
 * on `token_hash` grows with them, and the lookup on the hot refresh path gets
 * slower every week the deployment stays up.
 *
 * Rows are only removed once they can no longer authenticate anything: expired,
 * or revoked/used and past a short grace period that keeps them available for
 * an audit trail and for the "session list" UI immediately after a logout.
 */

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export interface CleanupResult {
  refreshTokensDeleted: number;
  authTokensDeleted: number;
}

export const cleanupExpiredTokens = async (): Promise<CleanupResult> => {
  const now = new Date();
  const graceCutoff = new Date(now.getTime() - GRACE_MS);

  const deletedRefresh = await db
    .delete(refreshTokens)
    .where(
      or(
        lt(refreshTokens.expiresAt, now),
        and(isNotNull(refreshTokens.revokedAt), lt(refreshTokens.revokedAt, graceCutoff))
      )
    )
    .returning({ tokenId: refreshTokens.tokenId });

  const deletedAuth = await db
    .delete(authTokens)
    .where(
      or(
        lt(authTokens.expiresAt, now),
        and(isNotNull(authTokens.usedAt), lt(authTokens.usedAt, graceCutoff))
      )
    )
    .returning({ tokenId: authTokens.tokenId });

  return {
    refreshTokensDeleted: deletedRefresh.length,
    authTokensDeleted: deletedAuth.length,
  };
};

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let timer: NodeJS.Timeout | null = null;

export const registerCleanupWorkers = (): void => {
  if (timer) return;

  const sweep = async () => {
    try {
      const { refreshTokensDeleted, authTokensDeleted } = await cleanupExpiredTokens();
      if (refreshTokensDeleted || authTokensDeleted) {
        console.log(
          `🧹 Token sweep: removed ${refreshTokensDeleted} refresh, ${authTokensDeleted} auth tokens`
        );
      }
    } catch (err) {
      // A failed sweep is not worth taking the process down for; the next one
      // covers the same rows.
      console.error('Token cleanup failed:', err);
    }
  };

  // Not on boot — a restart loop would otherwise hammer the database. First
  // sweep lands one interval in.
  timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  // Never hold the event loop open on shutdown.
  timer.unref();
};

export const stopCleanupWorkers = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
