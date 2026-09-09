import crypto from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits

/**
 * Get the encryption key from env. Must be a 64-char hex string (32 bytes).
 */
function getKey(): Buffer {
  const keyHex = env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length < 32) {
    throw new Error('ENCRYPTION_KEY must be set and at least 32 chars.');
  }
  // If key is hex, decode it; otherwise hash it to get 32 bytes
  if (/^[0-9a-f]{64}$/i.test(keyHex)) {
    return Buffer.from(keyHex, 'hex');
  }
  return crypto.createHash('sha256').update(keyHex).digest();
}

/**
 * Encrypt a plaintext string. Returns a base64 string of `iv:tag:ciphertext`.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // Concatenate iv + tag + ciphertext and encode as base64
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt a ciphertext string produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const combined = Buffer.from(ciphertext, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}
