import { z } from 'zod';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().regex(passwordRegex, 'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.'),
  fullName: z.string().min(1, 'Full name is required'),
  displayName: z.string().optional(),
  inviteToken: z.string().optional(),
}).strict();

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().regex(passwordRegex, 'New password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.'),
}).strict();

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
}).strict();

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().regex(passwordRegex, 'New password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.'),
}).strict();

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
}).strict();

/**
 * `users.presence` is an unconstrained `varchar(20)` with no DB-level check, so
 * this schema is the enum. The three values are the ones the design system
 * renders (AGENTS.md §3 Presence: online / away / offline); anything else would
 * be written to the column and then fall through to the client's offline
 * fallback, which is a silent data problem rather than a visible one.
 */
export const presenceValues = ['online', 'away', 'offline'] as const;

export const updatePresenceSchema = z.object({
  presence: z.enum(presenceValues),
}).strict();

export const updateStatusSchema = z.object({
  statusText: z.string().max(100, 'Status text must be 100 characters or fewer').optional(),
  presence: z.enum(presenceValues).optional(),
}).strict();

// `avatarUrl` only, deliberately — name and email have no update path (see
// AccountSettingsPage's own comment on why), so this schema stays narrow
// rather than growing into a general profile-patch endpoint.
export const updateProfileSchema = z.object({
  // `.url()` alone is not a scheme check — Zod accepts anything the URL
  // parser accepts, including `data:` and `javascript:`. This value is written
  // straight to `users.avatar_url` and rendered as an `<img src>`, so the
  // scheme has to be pinned or the field becomes a stored-payload sink.
  avatarUrl: z
    .string()
    .url('Must be a valid URL')
    .max(2048)
    .refine(
      (value) => /^https?:\/\//i.test(value),
      'Avatar URL must be an http(s) URL',
    )
    .nullable(),
}).strict();

// Mirrors `addTaskAttachmentSchema` (tasks.schemas.ts) — same base64-in-JSON
// upload shape, just without `filetype` (an avatar is always an image, set
// server-side, not client-asserted).
export const uploadAvatarSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string().max(100).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  fileBase64: z.string().min(1, 'fileBase64 is required'),
}).strict();
