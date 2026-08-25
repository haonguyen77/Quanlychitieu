import type { FinanceData } from '@/types';
import { cryptoService } from '@/services/crypto/cryptoService';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const FILE_NAME = 'finance.json';
const FOLDER_NAME = 'QLCT';
const MIME_TYPE = 'application/json';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const TOKEN_KEY = 'pdp_google_token';
const TOKEN_EXP_KEY = 'pdp_google_token_exp';

// Web OAuth Configuration
const WEB_CLIENT_ID = '360333034797-h538fkb028uqgc0fphclipvdda85e1b6.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

/**
 * Google Drive Service — Web Version
 * Uses OAuth 2.0 implicit grant flow via popup window.
 * No Chrome API dependency.
 */
class DriveService {
  token: string | null = null;
  private tokenExp = 0; // epoch ms when the access token expires (0 = unknown)
  lastError = '';

  constructor() {
    try {
      this.token = localStorage.getItem(TOKEN_KEY);
      const exp = localStorage.getItem(TOKEN_EXP_KEY);
      this.tokenExp = exp ? parseInt(exp, 10) || 0 : 0;
    } catch { /* */ }
  }

  private save(token: string | null, expiresInSec?: number) {
    this.token = token;
    // Google access tokens last ~1h. Store expiry with a 5-min safety margin.
    this.tokenExp = token ? Date.now() + ((expiresInSec ?? 3600) - 300) * 1000 : 0;
    try {
      if (token) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(TOKEN_EXP_KEY, String(this.tokenExp)); }
      else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_EXP_KEY); }
    } catch { /* */ }
  }

  /** True when we have no token, or the stored token is past its expiry. */
  private get isTokenValid(): boolean {
    return !!this.token && (this.tokenExp === 0 || Date.now() < this.tokenExp);
  }

  async getToken(interactive = false): Promise<string | null> {
    if (this.isTokenValid) return this.token;
    // Token missing or expired — try a silent refresh first (no popup).
    const silent = await this.silentLogin();
    if (silent) return silent;
    if (!interactive) { this.lastError = 'Not authenticated'; return null; }
    return this.login();
  }

  /**
   * Silent re-auth using a hidden iframe with prompt=none.
   * If the user still has an active Google session and previously granted
   * consent, Google returns a fresh access_token without any UI. Otherwise
   * it errors (login_required/consent_required) and we resolve null so the
   * caller can fall back to the interactive popup.
   */
  silentLogin(): Promise<string | null> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (val: string | null) => {
        if (done) return; done = true;
        window.removeEventListener('message', onMsg);
        try { document.body.removeChild(iframe); } catch { /* */ }
        clearTimeout(timer);
        resolve(val);
      };
      const redirectUri = `${window.location.origin}/auth/callback`;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(WEB_CLIENT_ID)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SCOPES)}&prompt=none`;

      const onMsg = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        const d = e.data as { source?: string; token?: string; expiresIn?: number } | null;
        if (!d || d.source !== 'gauth') return;
        if (d.token) { this.save(d.token, d.expiresIn); this.lastError = ''; finish(d.token); }
        else finish(null);
      };
      window.addEventListener('message', onMsg);

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = authUrl;
      document.body.appendChild(iframe);

      // Fallback: parse the iframe URL directly if postMessage isn't used.
      const timer = setTimeout(() => {
        try {
          const href = iframe.contentWindow?.location.href;
          if (href && href.startsWith(window.location.origin)) {
            const params = new URLSearchParams(new URL(href).hash.substring(1));
            const token = params.get('access_token');
            if (token) { this.save(token, Number(params.get('expires_in')) || undefined); this.lastError = ''; finish(token); return; }
          }
        } catch { /* cross-origin: session likely expired */ }
        finish(null);
      }, 4000);
    });
  }

  /**
   * Web OAuth 2.0 Implicit Grant Flow via popup.
   * Opens Google OAuth consent screen in a popup window.
   * Extracts access_token from the redirect URL hash.
   */
  async login(): Promise<string | null> {
    return new Promise((resolve) => {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(WEB_CLIENT_ID)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SCOPES)}&prompt=consent`;

      // Open popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(authUrl, 'google-auth', `width=${width},height=${height},left=${left},top=${top}`);

      if (!popup) {
        this.lastError = 'Popup blocked. Please allow popups for this site.';
        resolve(null);
        return;
      }

      // Listen for the callback
      const checkInterval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(checkInterval);
            if (!this.token) {
              this.lastError = 'Auth window closed';
              resolve(null);
            }
            return;
          }

          const popupUrl = popup.location.href;
          if (popupUrl && popupUrl.startsWith(window.location.origin)) {
            clearInterval(checkInterval);
            popup.close();

            const hash = new URL(popupUrl).hash.substring(1);
            const params = new URLSearchParams(hash);
            const token = params.get('access_token');

            if (token) {
              this.save(token, Number(params.get('expires_in')) || undefined);
              this.lastError = '';
              resolve(token);
            } else {
              const error = params.get('error') || 'No access token';
              this.lastError = error;
              resolve(null);
            }
          }
        } catch {
          // Cross-origin — popup hasn't redirected yet, keep waiting
        }
      }, 200);

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!popup.closed) popup.close();
        if (!this.token) {
          this.lastError = 'Auth timeout';
          resolve(null);
        }
      }, 120000);
    });
  }

  getLastError(): string { return this.lastError; }

  get isSignedIn(): boolean { return !!this.token; }

  async signIn(): Promise<boolean> {
    const token = await this.login();
    return !!token;
  }

  async signOut(): Promise<void> {
    this.save(null);
  }

  async revokeToken(): Promise<void> {
    this.save(null);
  }

  async getUserProfile(): Promise<{ email: string; avatar: string | null } | null> {
    if (!this.token) return null;
    try {
      const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return { email: data.email || '', avatar: data.picture || null };
    } catch { return null; }
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.token) throw new Error('Not authenticated');
    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${this.token}` },
    });
    if (response.status === 401 || response.status === 403) {
      this.save(null);
      const newToken = await this.login();
      if (!newToken) throw new Error('Re-authentication failed');
      return fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
      });
    }
    return response;
  }

  async findFile(): Promise<{ id: string; modifiedTime: string } | null> {
    const folderId = await this.findOrCreateFolder();
    if (!folderId) return null;
    const query = `name = '${FILE_NAME}' and '${folderId}' in parents and trashed = false`;
    const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&spaces=drive`;
    const response = await this.fetchWithAuth(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.files?.[0] ? { id: data.files[0].id, modifiedTime: data.files[0].modifiedTime } : null;
  }

  async downloadFile(fileId: string): Promise<FinanceData | null> {
    const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
    const response = await this.fetchWithAuth(url);
    if (!response.ok) return null;
    const parsed = await response.json();
    // Encrypted envelope on Drive → decrypt with PIN. Plaintext (legacy/new install) → as-is.
    if (cryptoService.isEncryptedEnvelope(parsed)) {
      if (!cryptoService.hasKey()) { this.lastError = 'LOCKED'; return null; }
      return cryptoService.decryptData<FinanceData>(parsed);
    }
    return parsed as FinanceData;
  }

  /**
   * Fetch remote finance file content WITHOUT decrypting.
   * Used to detect whether Drive holds an encrypted envelope that this client
   * cannot yet read (needs PIN) — so sync never clobbers ciphertext with plaintext.
   * Returns parsed JSON (envelope or plaintext FinanceData) or null if no file.
   */
  async fetchRemoteRaw(): Promise<unknown | null> {
    const file = await this.findFile();
    if (!file) return null;
    const url = `${DRIVE_API_BASE}/files/${file.id}?alt=media`;
    const response = await this.fetchWithAuth(url);
    if (!response.ok) return null;
    return response.json();
  }

  async uploadFile(data: FinanceData): Promise<string | null> {
    const existingFile = await this.findFile();
    // Encrypt to envelope when PIN encryption is enabled; else plaintext.
    let content: string;
    if (cryptoService.isEnabled() && cryptoService.hasKey()) {
      const envelope = await cryptoService.encryptData(data);
      content = JSON.stringify(envelope);
    } else {
      content = JSON.stringify(data, null, 2);
    }
    if (existingFile) return this.updateFile(existingFile.id, content);
    return this.createFile(content);
  }

  private async createFile(content: string): Promise<string | null> {
    const folderId = await this.findOrCreateFolder();
    const metadata: Record<string, unknown> = { name: FILE_NAME, mimeType: MIME_TYPE };
    if (folderId) metadata.parents = [folderId];
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: MIME_TYPE }));
    const url = `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id`;
    const response = await this.fetchWithAuth(url, { method: 'POST', body: form });
    if (!response.ok) return null;
    return (await response.json()).id;
  }

  private async updateFile(fileId: string, content: string): Promise<string | null> {
    const url = `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=media`;
    const response = await this.fetchWithAuth(url, {
      method: 'PATCH',
      headers: { 'Content-Type': MIME_TYPE },
      body: content,
    });
    if (!response.ok) return null;
    return fileId;
  }

  private async findOrCreateFolder(): Promise<string | null> {
    const query = `name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
    const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive`;
    const response = await this.fetchWithAuth(url);
    if (response.ok) {
      const data = await response.json();
      if (data.files?.[0]?.id) return data.files[0].id;
    }
    const metadata = { name: FOLDER_NAME, mimeType: FOLDER_MIME };
    const createResp = await this.fetchWithAuth(`${DRIVE_API_BASE}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    if (!createResp.ok) return null;
    return (await createResp.json()).id;
  }
}

export const driveService = new DriveService();
