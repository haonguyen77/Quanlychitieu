/**
 * PasscodeService — App-lock passcode, COMPLETELY INDEPENDENT from encryption PIN.
 *
 * - Passcode only controls access to the UI (app lock).
 * - Passcode does NOT derive encryption keys.
 * - Passcode does NOT affect Google Drive sync or finance.json.
 * - Passcode is stored as a PBKDF2 hash (never plaintext).
 *
 * Storage keys (localStorage):
 *   pdp_passcode_enabled  — '1' when passcode is active
 *   pdp_passcode_verify   — JSON { salt: b64, iterations: number, hash: b64 }
 */

const ENABLED_KEY = 'pdp_passcode_enabled';
const VERIFY_KEY = 'pdp_passcode_verify';
const ITERATIONS = 100000; // lighter than encryption PIN (no key derivation needed)

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

async function hashPasscode(passcode: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey, 256
  );
  return bufToB64(bits);
}

class PasscodeService {
  private unlocked = false;

  isEnabled(): boolean {
    try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
  }

  isUnlocked(): boolean {
    return !this.isEnabled() || this.unlocked;
  }

  isLocked(): boolean {
    return this.isEnabled() && !this.unlocked;
  }

  unlock(): void { this.unlocked = true; }

  lock(): void { this.unlocked = false; }

  async setup(passcode: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await hashPasscode(passcode, salt);
    const token: VerifyToken = { salt: bufToB64(salt), iterations: ITERATIONS, hash };
    localStorage.setItem(VERIFY_KEY, JSON.stringify(token));
    localStorage.setItem(ENABLED_KEY, '1');
    this.unlocked = true;
  }

  async verify(passcode: string): Promise<boolean> {
    const raw = localStorage.getItem(VERIFY_KEY);
    if (!raw) return false;
    try {
      const token = JSON.parse(raw) as VerifyToken;
      const hash = await hashPasscode(passcode, b64ToBytes(token.salt));
      if (hash === token.hash) { this.unlocked = true; return true; }
      return false;
    } catch { return false; }
  }

  async change(oldPasscode: string, newPasscode: string): Promise<boolean> {
    if (!(await this.verify(oldPasscode))) return false;
    await this.setup(newPasscode);
    return true;
  }

  async disable(passcode: string): Promise<boolean> {
    if (!(await this.verify(passcode))) return false;
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(VERIFY_KEY);
    this.unlocked = true;
    return true;
  }
}

export const passcodeService = new PasscodeService();
