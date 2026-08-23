/**
 * The exact password rule the backend enforces.
 *
 * Copied character for character from `passwordRegex` in
 * backend/src/modules/auth/auth.schemas.ts, where it gates register,
 * change-password and reset-password alike. Keeping one copy on the client
 * means the three forms can never disagree with each other, or with the server.
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const PASSWORD_RULE =
  'At least 8 characters, with an uppercase letter, a lowercase letter, a number, and one of @$!%*?&';

export const PASSWORD_ERROR =
  'Use at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character (@$!%*?&).';
