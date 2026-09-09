import { describe, it, expect, beforeAll, vi } from 'vitest';

const HEX_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

/**
 * `config/env.ts` snapshots `process.env` into a frozen object at import time,
 * so a test that wants a different key has to reset the module registry and
 * import again — mutating `process.env` after the fact changes nothing.
 */
const loadWithKey = async (key: string) => {
  vi.resetModules();
  process.env.ENCRYPTION_KEY = key;
  return import('./encryption.js');
};

let encrypt: (s: string) => string;
let decrypt: (s: string) => string;

beforeAll(async () => {
  process.env.DATABASE_URL ||= 'postgres://localhost:5432/none';
  process.env.JWT_SECRET ||= 'test-secret-that-is-at-least-32-chars-long';
  ({ encrypt, decrypt } = await loadWithKey(HEX_KEY));
});

describe('encryption', () => {
  it('round-trips a value', () => {
    const plaintext = 'ghp_aRealisticLookingGitHubTokenValue1234';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('round-trips unicode, empty and long strings', () => {
    for (const value of ['', 'héllo → wörld 🔐', 'a'.repeat(5000)]) {
      expect(decrypt(encrypt(value))).toBe(value);
    }
  });

  it('produces a different ciphertext each time', () => {
    // A fresh random IV per call. Without it, equal plaintexts would produce
    // equal ciphertexts and the token table would leak which rows share a value.
    const a = encrypt('same-input');
    const b = encrypt('same-input');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same-input');
    expect(decrypt(b)).toBe('same-input');
  });

  it('rejects a tampered ciphertext rather than returning garbage', () => {
    // The property that makes GCM worth using over CBC: the auth tag means a
    // modified token fails loudly instead of decrypting to nonsense.
    const raw = Buffer.from(encrypt('sensitive'), 'base64');
    raw[raw.length - 1] ^= 0xff;
    expect(() => decrypt(raw.toString('base64'))).toThrow();
  });

  it('rejects a ciphertext encrypted under a different key', async () => {
    const encrypted = encrypt('sensitive');
    const other = await loadWithKey('f'.repeat(64));
    expect(() => other.decrypt(encrypted)).toThrow();
  });

  it('derives a usable key from a non-hex passphrase', async () => {
    const passphrase = await loadWithKey('a-passphrase-that-is-not-hex-but-long-enough');
    expect(passphrase.decrypt(passphrase.encrypt('value'))).toBe('value');
  });

  it('refuses to operate without a key', async () => {
    const unset = await loadWithKey('');
    expect(() => unset.encrypt('value')).toThrow(/ENCRYPTION_KEY/);
  });
});
