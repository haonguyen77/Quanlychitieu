/**
 * cryptoService — Cross-client E2E encryption (Phase 6.0).
 *
 * SHARED SPEC (identical on WebApp / Extension / Android):
 * - KDF:  PBKDF2-HMAC-SHA256, 310,000 iterations, 256-bit key
 * - Enc:  AES-256-GCM, random 12-byte IV, 16-byte auth tag appended to ciphertext
 * - Envelope carries its own random `salt` + `iv` (base64) so any client can derive
 *   the same key from the same PIN. PIN is the ONLY shared secret; never stored/uploaded.
 *
 * KEY PERSISTENCE (new):
 * After successful PIN verification, the derived CryptoKey is stored as a
 * non-extractable key in IndexedDB ('pdp_keystore'). This means:
 * - Page reload does NOT lose the key → no need to re-enter PIN.
 * - PIN is NEVER stored (not in localStorage, sessionStorage, or anywhere).
 * - The persisted key can encrypt/decrypt but cannot be read as raw bytes.
 * - If the user clears browser data, the key is lost → PIN must be re-entered once.
 */

const ENABLED_KEY = 'pdp_enc_enabled';
const VERIFY_KEY = 'pdp_enc_verify';
const ITERATIONS = 310000;
const ENVELOPE_VERSION = 1;
const KEYSTORE_DB = 'pdp_keystore';
const KEYSTORE_STORE = 'keys';
const PERSISTED_KEY_ID = 'enc_key';
const PERSISTED_SALT_ID = 'enc_salt';

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

// ─── IndexedDB key persistence helpers ────────────────────────────────────────
function openKeystore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEYSTORE_DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(KEYSTORE_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeInKeystore(id: string, value: unknown): Promise<void> {
  const db = await openKeystore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEYSTORE_STORE, 'readwrite');
    tx.objectStore(KEYSTORE_STORE).put(value, id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getFromKeystore<T>(id: string): Promise<T | null> {
  try {
    const db = await openKeystore();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(KEYSTORE_STORE, 'readonly');
      const req = tx.objectStore(KEYSTORE_STORE).get(id);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch { return null; }
}

async function clearKeystore(): Promise<void> {
  try {
    const db = await openKeystore();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(KEYSTORE_STORE, 'readwrite');
      tx.objectStore(KEYSTORE_STORE).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch { /* ignore */ }
}

// ─── CryptoService ────────────────────────────────────────────────────────────

class CryptoService {
  private keyCache = new Map<string, CryptoKey>();
  private sessionSalt: Uint8Array | null = null;
  private _keyReady = false;
  private _pin: string | null = null; // held in memory after verification for on-demand key derivation

  isEnabled(): boolean {
    try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
  }

  /** True when encryption is enabled AND the key is available for encrypt/decrypt. */
  hasKey(): boolean { return this._keyReady; }

  /**
   * True when encryption is enabled but the key is NOT available.
   * This does NOT mean the app should be locked — that's PasscodeService's job.
   * This means the next sync/data-load that needs decrypt will require a PIN prompt.
   */
  needsPin(): boolean { return this.isEnabled() && !this._keyReady; }

  isEncryptedEnvelope(x: unknown): x is EncryptedEnvelope {
    const e = x as EncryptedEnvelope;
    return !!e && typeof e === 'object' && e.__enc === true && typeof e.ciphertext === 'string';
  }

  // ── Key persistence ─────────────────────────────────────────────────────────

  /** Try to load a previously persisted key from IndexedDB. Call once at startup. */
  async loadPersistedKey(): Promise<boolean> {
    if (this._keyReady) return true;
    try {
      const key = await getFromKeystore<CryptoKey>(PERSISTED_KEY_ID);
      const saltB64 = await getFromKeystore<string>(PERSISTED_SALT_ID);
      if (key && saltB64) {
        this.keyCache.set(saltB64, key);
        this.sessionSalt = b64ToBytes(saltB64);
        this._keyReady = true;
        return true;
      }
    } catch { /* IDB unavailable */ }
    return false;
  }

  /** Persist the current session key so it survives page reload. */
  private async persistKey(key: CryptoKey, salt: Uint8Array): Promise<void> {
    const saltB64 = bufToB64(salt);
    try {
      await storeInKeystore(PERSISTED_KEY_ID, key);
      await storeInKeystore(PERSISTED_SALT_ID, saltB64);
    } catch { /* best effort */ }
  }

  // ── Key derivation ──────────────────────────────────────────────────────────

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
      false, // non-extractable
      ['encrypt', 'decrypt']
    );
    this.keyCache.set(saltB64, key);
    return key;
  }

  private async pbkdf2Raw(pin: string, salt: Uint8Array): Promise<string> {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      baseKey, 256
    );
    return bufToB64(bits);
  }

  // ── Encrypt / Decrypt ───────────────────────────────────────────────────────

  async encryptData<T>(data: T): Promise<EncryptedEnvelope> {
    if (!this._keyReady || !this.sessionSalt) throw new Error('NO_KEY');
    const key = this.keyCache.get(bufToB64(this.sessionSalt));
    if (!key) throw new Error('NO_KEY');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
    return {
      __enc: true, version: ENVELOPE_VERSION, algorithm: 'AES-256-GCM', kdf: 'PBKDF2-SHA256',
      iterations: ITERATIONS, salt: bufToB64(this.sessionSalt), iv: bufToB64(iv),
      ciphertext: bufToB64(ct), updatedAt: new Date().toISOString(),
    };
  }

  async decryptData<T>(env: EncryptedEnvelope): Promise<T> {
    if (!this._keyReady) throw new Error('NO_KEY');
    if (env.version !== ENVELOPE_VERSION) throw new Error(`Unsupported envelope version ${env.version}`);
    const salt = b64ToBytes(env.salt);
    const saltB64 = bufToB64(salt);
    let key = this.keyCache.get(saltB64);
    if (!key) {
      if (!this._pin) throw new Error('NO_KEY');
      key = await this.deriveKey(this._pin, salt);
    }
    const iv = b64ToBytes(env.iv);
    const ct = b64ToBytes(env.ciphertext);
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, ct as unknown as BufferSource);
      return JSON.parse(new TextDecoder().decode(pt)) as T;
    } catch {
      throw new Error('DECRYPT_FAILED');
    }
  }

  /** Decrypt using a specific PIN (for envelopes with any salt). Used during sync. */
  async decryptWithPin<T>(pin: string, env: EncryptedEnvelope): Promise<T> {
    const salt = b64ToBytes(env.salt);
    const key = await this.deriveKey(pin, salt);
    const iv = b64ToBytes(env.iv);
    const ct = b64ToBytes(env.ciphertext);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, ct as unknown as BufferSource);
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  }

  // ── PIN lifecycle ───────────────────────────────────────────────────────────

  async setupPin(pin: string): Promise<void> {
    const verifySalt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await this.pbkdf2Raw(pin, verifySalt);
    const token: VerifyToken = { salt: bufToB64(verifySalt), iterations: ITERATIONS, hash };
    localStorage.setItem(VERIFY_KEY, JSON.stringify(token));
    localStorage.setItem(ENABLED_KEY, '1');
    const sessionSalt = crypto.getRandomValues(new Uint8Array(16));
    const key = await this.deriveKey(pin, sessionSalt);
    this.sessionSalt = sessionSalt;
    this._keyReady = true;
    this._pin = pin;
    await this.persistKey(key, sessionSalt);
  }

  async verifyPin(pin: string): Promise<boolean> {
    const raw = localStorage.getItem(VERIFY_KEY);
    if (!raw) return false;
    try {
      const token = JSON.parse(raw) as VerifyToken;
      const hash = await this.pbkdf2Raw(pin, b64ToBytes(token.salt));
      if (hash === token.hash) {
        const sessionSalt = crypto.getRandomValues(new Uint8Array(16));
        const key = await this.deriveKey(pin, sessionSalt);
        this.sessionSalt = sessionSalt;
        this._keyReady = true;
        this._pin = pin;
        await this.persistKey(key, sessionSalt);
        return true;
      }
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
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, ct as unknown as BufferSource);
      const data = JSON.parse(new TextDecoder().decode(pt)) as T;
      // PIN correct — persist
      const verifySalt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await this.pbkdf2Raw(pin, verifySalt);
      localStorage.setItem(VERIFY_KEY, JSON.stringify({ salt: bufToB64(verifySalt), iterations: ITERATIONS, hash }));
      localStorage.setItem(ENABLED_KEY, '1');
      const sessionSalt = crypto.getRandomValues(new Uint8Array(16));
      const sessionKey = await this.deriveKey(pin, sessionSalt);
      this.sessionSalt = sessionSalt;
      this._keyReady = true;
      this._pin = pin;
      await this.persistKey(sessionKey, sessionSalt);
      return data;
    } catch {
      return null;
    }
  }

  async changePin(oldPin: string, newPin: string): Promise<boolean> {
    if (!(await this.verifyPin(oldPin))) return false;
    // verifyPin already set up the new session — now re-setup with newPin
    await this.setupPin(newPin);
    return true;
  }

  /** Disable encryption entirely. Caller must re-save data as plaintext. */
  async disable(): Promise<void> {
    this._keyReady = false;
    this.keyCache.clear();
    this.sessionSalt = null;
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(VERIFY_KEY);
    await clearKeystore();
  }

  clearKey(): void {
    this._keyReady = false;
    this.keyCache.clear();
    this.sessionSalt = null;
    clearKeystore();
  }
}

export const cryptoService = new CryptoService();
