import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── users ───────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  userId:       uuid('user_id').primaryKey().defaultRandom(),
  email:        varchar('email', { length: 255 }).unique().notNull(),
  fullName:     varchar('full_name', { length: 255 }).notNull(),
  displayName:  varchar('display_name', { length: 80 }),
  avatarUrl:    text('avatar_url'),
  githubId:     varchar('github_id', { length: 64 }).unique(),
  githubLogin:  varchar('github_login', { length: 64 }),
  githubAccessToken: text('github_access_token'),
  googleId:     varchar('google_id', { length: 64 }).unique(),
  passwordHash: text('password_hash'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  presence:     varchar('presence', { length: 20 }).default('offline'),
  statusText:   varchar('status_text', { length: 100 }),
  statusEmoji:  varchar('status_emoji', { length: 20 }),
  preferences:  jsonb('preferences').default({}),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockoutUntil: timestamp('lockout_until', { withTimezone: true }),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt:    timestamp('deleted_at', { withTimezone: true }),
});

// ─── refresh_tokens ──────────────────────────────────────────────────────────
export const refreshTokens = pgTable('refresh_tokens', {
  tokenId:    uuid('token_id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }),
  tokenHash:  varchar('token_hash', { length: 64 }).unique().notNull(),
  deviceInfo: jsonb('device_info'),
  issuedAt:   timestamp('issued_at', { withTimezone: true }).defaultNow(),
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt:  timestamp('revoked_at', { withTimezone: true }),
});

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
