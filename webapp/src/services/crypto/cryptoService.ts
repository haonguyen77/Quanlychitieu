/**
 * cryptoService — Cross-client E2E encryption (Phase 6.0).
 *
 * SHARED SPEC (identical on WebApp / Extension / Android):
 * - KDF:  PBKDF2-HMAC-SHA256, 310,000 iterations, 256-bit key
 * - Enc:  AES-256-GCM, random 12-byte IV, 16-byte auth tag appended to ciphertext
 * - Envelope carries its own random `salt` + `iv` (base64) so any client can derive
 *   the same key from the same PIN. PIN is the ONLY shared secret; never stored/uploaded.
 *
 * Envelope (what lives on Google Drive AND in local IndexedDB):
 * {
 *   "__enc": true, "version": 1, "algorithm": "AES-256-GCM",
 *   "kdf": "PBKDF2-SHA256", "iterations": 310000,
 *   "salt": base64, "iv": base64, "ciphertext": base64, "updatedAt": iso
 * }
 * ciphertext = AES-GCM(JSON.stringify(FinanceData)) with tag appended (Web Crypto default).
 *
 * PIN verification (local only, separate salt): { salt, iterations, hash } where
 * hash = base64(PBKDF2(pin, verifySalt)). verifySalt != encryption salt.
 */

const ENABLED_KEY = 'pdp_enc_enabled';
const VERIFY_KEY = 'pdp_enc_verify';
const ITERATIONS = 310000;
const ENVELOPE_VERSION = 1;

export interface EncryptedEnvelope {
  __enc: true;
  version: number;
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;       // base64
  iv: string;         // base64
  ciphertext: string; // base64 (ct || 16-byte GCM tag)
  updatedAt?: string;
}

interface VerifyToken { salt: string; iterations: number; hash: string; }

// ─── base64 helpers ───────────────────────────────────────────────────────────
function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

class CryptoService {
  private pin: string | null = null;                 // in-memory only, cleared on reload
  private keyCache = new Map<string, CryptoKey>();    // saltB64 -> derived AES key
  private sessionSalt: Uint8Array | null = null;      // stable salt for this session's encrypts

  isEnabled(): boolean {
    try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
  }
  hasKey(): boolean { return this.pin !== null; }
  isLocked(): boolean { return this.isEnabled() && !this.hasKey(); }

  isEncryptedEnvelope(x: unknown): x is EncryptedEnvelope {
    const e = x as EncryptedEnvelope;
    return !!e && typeof e === 'object' && e.__enc === true && typeof e.ciphertext === 'string';
  }

  private async deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const saltB64 = bufToB64(salt);
    const cached = this.keyCache.get(saltB64);
    if (cached) return cached;
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    this.keyCache.set(saltB64, key);
    return key;
  }

  /** PBKDF2 raw bytes (for PIN verification token). */
  private async pbkdf2Raw(pin: string, salt: Uint8Array): Promise<string> {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
      baseKey,
      256
    );
    return bufToB64(bits);
  }

  /** Encrypt any object → self-describing envelope. Requires PIN loaded. */
  async encryptData<T>(data: T): Promise<EncryptedEnvelope> {
    if (!this.pin) throw new Error('LOCKED');
    if (!this.sessionSalt) this.sessionSalt = crypto.getRandomValues(new Uint8Array(16));
    const key = await this.deriveKey(this.pin, this.sessionSalt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
    return {
      __enc: true,
      version: ENVELOPE_VERSION,
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: ITERATIONS,
      salt: bufToB64(this.sessionSalt),
      iv: bufToB64(iv),
      ciphertext: bufToB64(ct),
      updatedAt: new Date().toISOString(),
    };
  }

  /** Decrypt an envelope → object. Requires PIN loaded. Throws on wrong PIN / bad version. */
  async decryptData<T>(env: EncryptedEnvelope): Promise<T> {
    if (!this.pin) throw new Error('LOCKED');
    if (env.version !== ENVELOPE_VERSION) throw new Error(`Unsupported envelope version ${env.version}`);
    const key = await this.deriveKey(this.pin, b64ToBytes(env.salt));
    const iv = b64ToBytes(env.iv);
    const ct = b64ToBytes(env.ciphertext);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, ct as unknown as BufferSource);
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  }

  /** First-time PIN setup: create verification token, hold PIN for session. */
  async setupPin(pin: string): Promise<void> {
    const verifySalt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await this.pbkdf2Raw(pin, verifySalt);
    const token: VerifyToken = { salt: bufToB64(verifySalt), iterations: ITERATIONS, hash };
    localStorage.setItem(VERIFY_KEY, JSON.stringify(token));
    localStorage.setItem(ENABLED_KEY, '1');
    this.pin = pin;
    this.keyCache.clear();
    this.sessionSalt = crypto.getRandomValues(new Uint8Array(16));
  }

  /** Verify PIN against local token; on success hold PIN for session. */
  async verifyPin(pin: string): Promise<boolean> {
    const raw = localStorage.getItem(VERIFY_KEY);
    if (!raw) return false;
    try {
      const token = JSON.parse(raw) as VerifyToken;
      const hash = await this.pbkdf2Raw(pin, b64ToBytes(token.salt));
      if (hash === token.hash) {
        this.pin = pin;
        this.keyCache.clear();
        this.sessionSalt = crypto.getRandomValues(new Uint8Array(16));
        return true;
      }
      return false;
    } catch { return false; }
  }

  /**
   * Fresh-client onboarding: adopt a vault encrypted by ANOTHER client.
   * Tries to decrypt the given envelope with `pin`. On success: holds PIN,
   * creates a local verify token, marks enabled, returns decrypted data.
   * On wrong PIN (GCM auth fail): returns null, no state change.
   */
  async establishFromEnvelope<T>(pin: string, env: EncryptedEnvelope): Promise<T | null> {
    if (env.version !== ENVELOPE_VERSION) return null;
    try {
      const key = await this.deriveKey(pin, b64ToBytes(env.salt));
      const iv = b64ToBytes(env.iv);
      const ct = b64ToBytes(env.ciphertext);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, ct as unknown as BufferSource);
      const data = JSON.parse(new TextDecoder().decode(pt)) as T;
      // PIN is correct — persist a local verify token for fast future unlocks
      this.pin = pin;
      const verifySalt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await this.pbkdf2Raw(pin, verifySalt);
      const token: VerifyToken = { salt: bufToB64(verifySalt), iterations: ITERATIONS, hash };
      localStorage.setItem(VERIFY_KEY, JSON.stringify(token));
      localStorage.setItem(ENABLED_KEY, '1');
      this.sessionSalt = crypto.getRandomValues(new Uint8Array(16));
      return data;
    } catch {
      this.keyCache.clear();
      return null;
    }
  }

  /** Disable encryption. Caller must re-save data as plaintext afterwards. */
  disable(): void {
    this.pin = null;
    this.keyCache.clear();
    this.sessionSalt = null;
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(VERIFY_KEY);
  }

  async changePin(oldPin: string, newPin: string): Promise<boolean> {
    if (!(await this.verifyPin(oldPin))) return false;
    await this.setupPin(newPin);
    return true;
  }

  clearKey(): void { this.pin = null; this.keyCache.clear(); this.sessionSalt = null; }
}

export const cryptoService = new CryptoService();
