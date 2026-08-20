/**
 * cryptoService — Local-at-rest encryption for IndexedDB (Cách A).
 *
 * DESIGN:
 * - AES-GCM 256 encryption, key derived from user PIN via PBKDF2 (SHA-256, 150k iters).
 * - Key held in memory ONLY (never persisted). Salt + verify-token in localStorage (not secret).
 * - Encrypts ONLY the local IndexedDB blob. Google Drive finance.json stays PLAINTEXT
 *   so Android + Chrome Extension sync keeps working unchanged.
 * - No hard-coded key. If no PIN set → data stays plaintext (opt-in feature).
 *
 * localStorage keys:
 * - pdp_enc_enabled : '1' when PIN encryption is on
 * - pdp_enc_salt    : base64 PBKDF2 salt
 * - pdp_enc_verify  : encrypted known token (to verify PIN correctness on unlock)
 */

const ENABLED_KEY = 'pdp_enc_enabled';
const SALT_KEY = 'pdp_enc_salt';
const VERIFY_KEY = 'pdp_enc_verify';
const VERIFY_PLAINTEXT = 'QLCT_PIN_OK';
const PBKDF2_ITERATIONS = 150000;

export interface EncryptedBlob {
  __enc: 1;
  iv: string; // base64
  ct: string; // base64 ciphertext
}

// ─── base64 helpers ───────────────────────────────────────────────────────────
function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

class CryptoService {
  private key: CryptoKey | null = null;

  isEnabled(): boolean {
    try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
  }

  hasKey(): boolean {
    return this.key !== null;
  }

  /** True when encryption is enabled but the key isn't loaded yet (needs PIN). */
  isLocked(): boolean {
    return this.isEnabled() && !this.hasKey();
  }

  isEncryptedBlob(x: unknown): x is EncryptedBlob {
    return !!x && typeof x === 'object' && (x as EncryptedBlob).__enc === 1;
  }

  private async deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async encryptWithKey(key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    return { __enc: 1, iv: bufToB64(iv.buffer), ct: bufToB64(ct) };
  }

  private async decryptWithKey(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
    const iv = b64ToBuf(blob.iv);
    const ct = b64ToBuf(blob.ct);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(pt);
  }

  /** Encrypt an object → EncryptedBlob. Requires key loaded. */
  async encryptData<T>(data: T): Promise<EncryptedBlob> {
    if (!this.key) throw new Error('No encryption key');
    return this.encryptWithKey(this.key, JSON.stringify(data));
  }

  /** Decrypt an EncryptedBlob → object. Requires key loaded. */
  async decryptData<T>(blob: EncryptedBlob): Promise<T> {
    if (!this.key) throw new Error('No encryption key');
    const json = await this.decryptWithKey(this.key, blob);
    return JSON.parse(json) as T;
  }

  /**
   * Enable PIN encryption: generate salt, derive key, store verify token.
   * Caller must then re-save current data so it gets encrypted.
   */
  async enablePin(pin: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await this.deriveKey(pin, salt);
    const verify = await this.encryptWithKey(key, VERIFY_PLAINTEXT);
    this.key = key;
    localStorage.setItem(SALT_KEY, bufToB64(salt.buffer));
    localStorage.setItem(VERIFY_KEY, JSON.stringify(verify));
    localStorage.setItem(ENABLED_KEY, '1');
  }

  /**
   * Attempt to unlock with a PIN. Returns true if correct.
   * On success the key is held in memory for the session.
   */
  async unlock(pin: string): Promise<boolean> {
    const saltB64 = localStorage.getItem(SALT_KEY);
    const verifyRaw = localStorage.getItem(VERIFY_KEY);
    if (!saltB64 || !verifyRaw) return false;
    try {
      const salt = b64ToBuf(saltB64);
      const key = await this.deriveKey(pin, salt);
      const verify = JSON.parse(verifyRaw) as EncryptedBlob;
      const decrypted = await this.decryptWithKey(key, verify);
      if (decrypted === VERIFY_PLAINTEXT) {
        this.key = key;
        return true;
      }
      return false;
    } catch {
      return false; // wrong PIN → GCM auth fails
    }
  }

  /** Disable PIN encryption. Caller must re-save current data as plaintext afterwards. */
  disablePin(): void {
    this.key = null;
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(SALT_KEY);
    localStorage.removeItem(VERIFY_KEY);
  }

  /** Change PIN: verify old, then re-key. Caller must re-save data afterwards. */
  async changePin(oldPin: string, newPin: string): Promise<boolean> {
    const ok = await this.unlock(oldPin);
    if (!ok) return false;
    await this.enablePin(newPin); // new salt + verify + key
    return true;
  }

  clearKey(): void {
    this.key = null;
  }
}

export const cryptoService = new CryptoService();
