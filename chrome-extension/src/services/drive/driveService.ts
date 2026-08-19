import type { FinanceData } from '@/types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const FILE_NAME = 'finance.json';
const FOLDER_NAME = 'QLCT';
const MIME_TYPE = 'application/json';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const TOKEN_KEY = 'pdp_google_token';

/**
 * Google Drive Service
 * Uses launchWebAuthFlow for cross-browser support (Chrome + Edge).
 * Token persisted in localStorage.
 */
class DriveService {
  token: string | null = null;
  lastError = '';

  constructor() {
    try { this.token = localStorage.getItem(TOKEN_KEY); } catch { /* */ }
  }

  private save(token: string | null) {
    this.token = token;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { /* */ }
  }

  async getToken(interactive = false): Promise<string | null> {
    if (this.token) return this.token;
    if (!interactive) { this.lastError = 'Not authenticated'; return null; }
    return this.login();
  }

  async login(): Promise<string | null> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.identity) {
        this.lastError = 'chrome.identity not available';
        resolve(null);
        return;
      }
      const manifest = chrome.runtime.getManifest() as { oauth2?: { client_id?: string; scopes?: string[] } };
      const clientId = manifest.oauth2?.client_id;
      const scopes = manifest.oauth2?.scopes?.join(' ') || '';
      const redirectUrl = chrome.identity.getRedirectURL();

      if (!clientId) { this.lastError = 'No client_id in manifest'; resolve(null); return; }

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${encodeURIComponent(scopes)}`;

      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          this.lastError = chrome.runtime.lastError?.message || 'Auth cancelled';
          resolve(null);
        } else {
          try {
            const hash = new URL(responseUrl).hash.substring(1);
            const token = new URLSearchParams(hash).get('access_token');
            if (token) {
              this.save(token);
              this.lastError = '';
              resolve(token);
            } else {
              this.lastError = 'No access_token in response';
              resolve(null);
            }
          } catch (e) {
            this.lastError = String(e);
            resolve(null);
          }
        }
      });
    });
  }

  getLastError(): string { return this.lastError; }

  async revokeToken(): Promise<void> {
    this.save(null);
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.token) throw new Error('Not authenticated');
    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${this.token}` },
    });
    if (response.status === 401 || response.status === 403) {
      // Token expired or insufficient scopes - clear and re-login
      this.save(null);
      const newToken = await this.login();
      if (!newToken) throw new Error('Re-authentication failed - insufficient scopes');
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
    return response.json();
  }

  async uploadFile(data: FinanceData): Promise<string | null> {
    const existingFile = await this.findFile();
    const content = JSON.stringify(data, null, 2);
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

  /** Find or create the QLCT folder on Google Drive */
  private async findOrCreateFolder(): Promise<string | null> {
    // Search for existing folder
    const query = `name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
    const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive`;
    const response = await this.fetchWithAuth(url);
    if (response.ok) {
      const data = await response.json();
      if (data.files?.[0]?.id) return data.files[0].id;
    }
    // Create folder
    const metadata = { name: FOLDER_NAME, mimeType: FOLDER_MIME };
    const createResp = await this.fetchWithAuth(`${DRIVE_API_BASE}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    if (!createResp.ok) return null;
    return (await createResp.json()).id;
  }

  async uploadImage(file: File): Promise<string | null> {
    const metadata = { name: `img_${Date.now()}_${file.name}`, mimeType: file.type };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    const url = `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id`;
    const response = await this.fetchWithAuth(url, { method: 'POST', body: form });
    if (!response.ok) return null;
    return (await response.json()).id;
  }

  getImageUrl(fileId: string): string {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
  }

  async getUserProfile(): Promise<{ email: string; name: string; avatar?: string } | null> {
    try {
      const response = await this.fetchWithAuth('https://www.googleapis.com/oauth2/v2/userinfo');
      if (!response.ok) return null;
      const data = await response.json();
      return { email: data.email, name: data.name, avatar: data.picture };
    } catch { return null; }
  }
}

export const driveService = new DriveService();
