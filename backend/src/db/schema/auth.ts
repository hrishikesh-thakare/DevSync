import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── users ───────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  userId:       uuid('user_id').primaryKey().defaultRandom(),
  email:        varchar('email', { length: 255 }).notNull(),
  fullName:     varchar('full_name', { length: 255 }).notNull(),
  displayName:  varchar('display_name', { length: 80 }),
  avatarUrl:    text('avatar_url'),
  githubId:     varchar('github_id', { length: 64 }),
  githubLogin:  varchar('github_login', { length: 64 }),
  githubAccessToken: text('github_access_token'),
  passwordHash: text('password_hash'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  presence:     varchar('presence', { length: 20 }).default('offline'),
  statusText:   varchar('status_text', { length: 100 }),
  preferences:  jsonb('preferences').default({}),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockoutUntil: timestamp('lockout_until', { withTimezone: true }),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt:    timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  // Identity is unique among *live* accounts only. A plain UNIQUE on email
  // meant a soft-deleted account kept reserving its address forever: `register`
  // saw the row and refused, `login` filtered it out and refused too, so the
  // user was stuck between two contradictory errors with no way back in.
  uniqueIndex('users_email_active_unique')
    .on(sql`lower(${table.email})`)
    .where(sql`${table.deletedAt} IS NULL`),
  uniqueIndex('users_github_id_active_unique')
    .on(table.githubId)
    .where(sql`${table.deletedAt} IS NULL AND ${table.githubId} IS NOT NULL`),
]);

// ─── refresh_tokens ──────────────────────────────────────────────────────────
export const refreshTokens = pgTable('refresh_tokens', {
  tokenId:    uuid('token_id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }),
  tokenHash:  varchar('token_hash', { length: 64 }).unique().notNull(),
  // Shared by every token in one rotation chain: a fresh value on login/
  // register/oauth, carried forward unchanged on each `/auth/refresh` rotation.
  // Lets `refresh` tell "this token was already rotated out" (reuse — the
  // classic signal a refresh token was stolen and the thief raced the real
  // user) apart from "this token never existed", and revoke the *whole*
  // chain rather than just the one token when reuse is detected.
  familyId:   uuid('family_id').notNull().defaultRandom(),
  deviceInfo: jsonb('device_info'),
  issuedAt:   timestamp('issued_at', { withTimezone: true }).defaultNow(),
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt:  timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  // Session list, revoke-others, and the 6-hourly cleanup sweep all filter here.
  index('idx_refresh_tokens_user').on(table.userId),
  // Reuse detection revokes every row sharing a family in one UPDATE.
  index('idx_refresh_tokens_family').on(table.familyId),
]);

// ─── auth_tokens ─────────────────────────────────────────────────────────────
// Single-use, time-limited tokens for password resets and email verification.
// Only the SHA-256 hash is stored, never the raw token.
export const authTokens = pgTable('auth_tokens', {
  tokenId:    uuid('token_id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  type:       varchar('type', { length: 30 }).notNull(), // password_reset | email_verify
  tokenHash:  varchar('token_hash', { length: 64 }).unique().notNull(),
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt:     timestamp('used_at', { withTimezone: true }),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  authTokens: many(authTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.userId],
  }),
}));

export const authTokensRelations = relations(authTokens, ({ one }) => ({
  user: one(users, {
    fields: [authTokens.userId],
    references: [users.userId],
  }),
}));
