/**
 * cryptoService — Cross-client E2E encryption (Phase 6.0).
 *
 * SPEC: PBKDF2-HMAC-SHA256 310k iter → AES-256-GCM. Envelope carries salt+iv (b64).
 * PIN is the only shared secret. Never stored plaintext on disk/Drive.
 *
 * KEY MANAGEMENT:
 * - PIN is held in sessionStorage (survives page reload within tab, lost on tab close).
 * - On decrypt: derive key using PIN + envelope.salt (NOT a random session salt).
 * - On encrypt: derive key using PIN + a fresh random salt (salt is stored in envelope).
 * - Cross-client: any client with the same PIN can decrypt any envelope regardless of salt.
 */

const ENABLED_KEY = 'pdp_enc_enabled';
const VERIFY_KEY = 'pdp_enc_verify';
const SESSION_PIN_KEY = '__pdp_k'; // sessionStorage only (tab-scoped, not persisted to disk)
const ITERATIONS = 310000;
const ENVELOPE_VERSION = 1;

export interface EncryptedEnvelope {
  __enc: true;
  version: number;
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  updatedAt?: string;
}

interface VerifyToken { salt: string; iterations: number; hash: string; }

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
  private _pin: string | null = null;
  private keyCache = new Map<string, CryptoKey>();

  constructor() {
    // Restore PIN from sessionStorage (survives reload within same tab)
    try { this._pin = sessionStorage.getItem(SESSION_PIN_KEY); } catch { /* */ }
  }

  isEnabled(): boolean {
    try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
  }

  hasKey(): boolean { return this._pin !== null; }

  /** True when encryption is set up but PIN not yet entered this session. */
  needsPin(): boolean { return this.isEnabled() && !this.hasKey(); }

  isEncryptedEnvelope(x: unknown): x is EncryptedEnvelope {
    return !!x && typeof x === 'object' && (x as Record<string, unknown>).__enc === true && typeof (x as Record<string, unknown>).ciphertext === 'string';
  }

  // ── Key derivation (always from PIN + salt) ─────────────────────────────────

  private async deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const saltB64 = bufToB64(salt);
    const cached = this.keyCache.get(saltB64);
    if (cached) return cached;
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    this.keyCache.set(saltB64, key);
    return key;
  }

  private async pbkdf2Raw(pin: string, salt: Uint8Array): Promise<string> {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, baseKey, 256);
    return bufToB64(bits);
  }

  private holdPin(pin: string): void {
    this._pin = pin;
    this.keyCache.clear();
    try { sessionStorage.setItem(SESSION_PIN_KEY, pin); } catch { /* */ }
  }

  // ── Encrypt / Decrypt ───────────────────────────────────────────────────────

  async encryptData<T>(data: T): Promise<EncryptedEnvelope> {
    if (!this._pin) throw new Error('NO_KEY');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await this.deriveKey(this._pin, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
    return {
      __enc: true, version: ENVELOPE_VERSION, algorithm: 'AES-256-GCM', kdf: 'PBKDF2-SHA256',
      iterations: ITERATIONS, salt: bufToB64(salt), iv: bufToB64(iv),
      ciphertext: bufToB64(ct), updatedAt: new Date().toISOString(),
    };
  }

  async decryptData<T>(env: EncryptedEnvelope): Promise<T> {
    if (!this._pin) throw new Error('NO_KEY');
    if (env.version !== ENVELOPE_VERSION) throw new Error(`Unsupported envelope version ${env.version}`);
    const salt = b64ToBytes(env.salt);
    const key = await this.deriveKey(this._pin, salt);
    const iv = b64ToBytes(env.iv);
    const ct = b64ToBytes(env.ciphertext);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  }

  // ── PIN lifecycle ───────────────────────────────────────────────────────────

  async setupPin(pin: string): Promise<void> {
    const verifySalt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await this.pbkdf2Raw(pin, verifySalt);
    localStorage.setItem(VERIFY_KEY, JSON.stringify({ salt: bufToB64(verifySalt), iterations: ITERATIONS, hash }));
    localStorage.setItem(ENABLED_KEY, '1');
    this.holdPin(pin);
  }

  async verifyPin(pin: string): Promise<boolean> {
    const raw = localStorage.getItem(VERIFY_KEY);
    if (!raw) return false;
    try {
      const token = JSON.parse(raw) as VerifyToken;
      const hash = await this.pbkdf2Raw(pin, b64ToBytes(token.salt));
      if (hash === token.hash) { this.holdPin(pin); return true; }
      return false;
    } catch { return false; }
  }

  async establishFromEnvelope<T>(pin: string, env: EncryptedEnvelope): Promise<T | null> {
    if (env.version !== ENVELOPE_VERSION) return null;
    try {
      const salt = b64ToBytes(env.salt);
      const key = await this.deriveKey(pin, salt);
      const iv = b64ToBytes(env.iv);
      const ct = b64ToBytes(env.ciphertext);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      const data = JSON.parse(new TextDecoder().decode(pt)) as T;
      // PIN correct — save verify token + hold PIN
      const verifySalt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await this.pbkdf2Raw(pin, verifySalt);
      localStorage.setItem(VERIFY_KEY, JSON.stringify({ salt: bufToB64(verifySalt), iterations: ITERATIONS, hash }));
      localStorage.setItem(ENABLED_KEY, '1');
      this.holdPin(pin);
      return data;
    } catch { return null; }
  }

  async changePin(oldPin: string, newPin: string): Promise<boolean> {
    if (!(await this.verifyPin(oldPin))) return false;
    await this.setupPin(newPin);
    return true;
  }

  async disable(): Promise<void> {
    this._pin = null;
    this.keyCache.clear();
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(VERIFY_KEY);
    try { sessionStorage.removeItem(SESSION_PIN_KEY); } catch { /* */ }
  }

  clearKey(): void {
    this._pin = null;
    this.keyCache.clear();
    try { sessionStorage.removeItem(SESSION_PIN_KEY); } catch { /* */ }
  }

  /** Try to restore PIN from sessionStorage (called at startup). */
  async loadPersistedKey(): Promise<boolean> {
    return this._pin !== null;
  }
}

export const cryptoService = new CryptoService();
