import type { FinanceData } from '@/types';
import { driveService } from '@/services/drive/driveService';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { cryptoService } from '@/services/crypto/cryptoService';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'conflict' | 'error' | 'locked';

export interface SyncResult {
  status: SyncStatus;
  message: string;
  data?: FinanceData;
}

/**
 * Sync Engine
 * 
 * Strategy: Last-Write-Wins with timestamp comparison.
 * 
 * Flow:
 * 1. On open: Check Drive for newer version → download if newer
 * 2. On edit: Write to IndexedDB immediately → queue Drive upload
 * 3. Conflict: Compare lastModified timestamps
 * 
 * Future enhancement: Field-level merge for true conflict resolution.
 */
class SyncService {
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 3000; // Wait 3s after last edit before syncing

  /**
   * True when Drive holds an encrypted envelope this client cannot decrypt yet
   * (no PIN key loaded). In that state we must NOT push plaintext over it.
   */
  private async isRemoteLocked(): Promise<boolean> {
    const raw = await driveService.fetchRemoteRaw();
    return !!raw && cryptoService.isEncryptedEnvelope(raw) && !cryptoService.hasKey();
  }

  /**
   * Pull latest data from Google Drive
   * Called on app open or manual sync.
   * Works even when local database is empty (fresh install).
   */
  async pull(): Promise<SyncResult> {
    try {
      const token = driveService.token;
      if (!token) {
        return { status: 'idle', message: 'Not authenticated' };
      }

      const remoteFile = await driveService.findFile();
      if (!remoteFile) {
        // No file on Drive yet
        return { status: 'idle', message: 'No remote file found on Drive' };
      }

      // Encrypted Drive data we can't read yet → require PIN (don't clobber).
      if (await this.isRemoteLocked()) {
        return { status: 'locked', message: 'Dữ liệu Drive đã mã hóa — cần nhập mã PIN.' };
      }

      const localData = await indexedDBService.loadData();
      const localModified = localData?.lastModified
        ? new Date(localData.lastModified).getTime()
        : 0;
      const remoteModified = new Date(remoteFile.modifiedTime).getTime();

      // Download if: no local data (fresh install) OR remote is newer
      if (!localData || remoteModified > localModified) {
        const remoteData = await driveService.downloadFile(remoteFile.id);
        if (remoteData) {
          await indexedDBService.saveData(remoteData);
          const recordCount = remoteData.records?.length ?? 0;
          const moduleCount = remoteData.modules?.length ?? 0;
          return {
            status: 'success',
            message: `Đã tải từ Drive: ${moduleCount} modules, ${recordCount} records`,
            data: remoteData,
          };
        } else {
          return { status: 'error', message: 'Failed to download file from Drive' };
        }
      }

      return { status: 'success', message: 'Local data is up to date' };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Pull failed',
      };
    }
  }

  /**
   * Push local data to Google Drive
   * SAFETY: refuses to push if local has fewer records than remote (prevents data loss)
   */
  async push(): Promise<SyncResult> {
    try {
      const token = driveService.token;
      if (!token) {
        return { status: 'idle', message: 'Not authenticated' };
      }

      const localData = await indexedDBService.loadData();
      if (!localData) {
        return { status: 'error', message: 'No local data to push' };
      }

      // SAFETY: never overwrite an encrypted Drive envelope with plaintext when locked.
      if (await this.isRemoteLocked()) {
        return { status: 'locked', message: 'Dữ liệu Drive đã mã hóa — cần nhập mã PIN trước khi đồng bộ.' };
      }

      // SAFETY CHECK: don't push if local has significantly fewer records than remote
      const remoteFile = await driveService.findFile();
      if (remoteFile) {
        const remoteData = await driveService.downloadFile(remoteFile.id);
        if (remoteData) {
          const localRecords = localData.records?.length ?? 0;
          const remoteRecords = remoteData.records?.length ?? 0;
          // If remote has records but local is empty or much smaller → REFUSE to push
          if (remoteRecords > 5 && localRecords < remoteRecords * 0.5) {
            return { status: 'error', message: `An toàn: không push vì local (${localRecords} records) ít hơn remote (${remoteRecords} records). Dùng "Đồng bộ ngay" thay vì push.` };
          }
        }
      }

      const fileId = await driveService.uploadFile(localData);
      if (fileId) {
        return { status: 'success', message: 'Pushed to Drive' };
      }

      return { status: 'error', message: 'Upload failed' };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Push failed',
      };
    }
  }

  /**
   * Schedule a push with debouncing.
   * Prevents flooding Drive API during rapid edits.
   */
  schedulePush(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(async () => {
      await this.push();
    }, this.DEBOUNCE_MS);
  }

  /**
   * Full sync cycle: pull remote → merge by UUID+updatedAt → push merged → save local
   * If local database is empty (fresh install), does a pull-only operation.
   */
  async fullSync(): Promise<SyncResult> {
    try {
      const token = driveService.token;
      if (!token) {
        return { status: 'idle', message: 'Not authenticated' };
      }

      // SAFETY: never overwrite an encrypted Drive envelope with plaintext when locked.
      if (await this.isRemoteLocked()) {
        return { status: 'locked', message: 'Dữ liệu Drive đã mã hóa — cần nhập mã PIN trước khi đồng bộ.' };
      }

      const localData = await indexedDBService.loadData();

      // Download remote
      const remoteFile = await driveService.findFile();
      let remoteData: FinanceData | null = null;
      if (remoteFile) {
        remoteData = await driveService.downloadFile(remoteFile.id);
      }

      // Case 1: No local data (fresh install)
      if (!localData) {
        if (remoteData) {
          // Fresh install + remote exists → just import remote data
          await indexedDBService.saveData(remoteData);
          const recordCount = remoteData.records?.length ?? 0;
          const moduleCount = remoteData.modules?.length ?? 0;
          return {
            status: 'success',
            message: `Initial sync: ${moduleCount} modules, ${recordCount} records imported`,
            data: remoteData,
          };
        } else {
          // Fresh install + no remote → nothing to do
          return { status: 'idle', message: 'No data available (empty Drive and empty local)' };
        }
      }

      // Case 2: Local data exists
      let mergedData: FinanceData;
      let syncStats = { addedToRemote: 0, addedFromRemote: 0, updated: 0 };
      if (!remoteData) {
        // No remote - just push local
        mergedData = { ...localData, lastModified: new Date().toISOString() };
        syncStats.addedToRemote = localData.records?.length ?? 0;
      } else {
        // Merge records by UUID + updatedAt
        const result = this.mergeData(localData, remoteData);
        mergedData = result.data;
        syncStats = { addedToRemote: result.addedToRemote, addedFromRemote: result.addedFromRemote, updated: result.updated };
      }

      // SAFETY: verify merged data has at least as many records as remote
      const mergedRecordCount = mergedData.records?.length ?? 0;
      if (remoteData && (remoteData.records?.length ?? 0) > 5 && mergedRecordCount < (remoteData.records?.length ?? 0) * 0.5) {
        // Something went wrong with merge - don't upload, just import remote
        await indexedDBService.saveData(remoteData);
        return { status: 'error', message: `An toàn: merged data (${mergedRecordCount}) ít hơn remote (${remoteData.records?.length}). Đã khôi phục từ Drive.`, data: remoteData };
      }

      // Upload merged
      const fileId = await driveService.uploadFile(mergedData);
      if (!fileId) {
        return { status: 'error', message: 'Upload failed' };
      }

      // Save merged locally
      await indexedDBService.saveData(mergedData);

      return { status: 'success', message: `↑${syncStats.addedToRemote} lên Drive | ↓${syncStats.addedFromRemote} từ Drive${syncStats.updated > 0 ? ` | ${syncStats.updated} cập nhật` : ''}`, data: mergedData };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }

  /**
   * Merge local and remote FinanceData by UUID + updatedAt
   */
  private mergeData(local: FinanceData, remote: FinanceData): { data: FinanceData; addedToRemote: number; addedFromRemote: number; updated: number } {
    const merged: FinanceData = { ...remote };

    // Merge records by id + updatedAt — track counts
    const localMap = new Map(local.records.map((r) => [r.id, r]));
    const remoteMap = new Map(remote.records.map((r) => [r.id, r]));
    let addedToRemote = 0; // local-only → will be uploaded
    let addedFromRemote = 0; // remote-only → will be downloaded
    let updated = 0; // conflicts resolved

    const mergedRecords = new Map<string, typeof local.records[0]>();

    // All remote records
    for (const [id, remoteRec] of remoteMap) {
      const localRec = localMap.get(id);
      if (localRec) {
        const lt = new Date(localRec.updatedAt || localRec.createdAt || '2000-01-01').getTime();
        const rt = new Date(remoteRec.updatedAt || remoteRec.createdAt || '2000-01-01').getTime();
        if (lt > rt) { mergedRecords.set(id, localRec); updated++; }
        else { mergedRecords.set(id, remoteRec); }
      } else {
        mergedRecords.set(id, remoteRec);
        addedFromRemote++;
      }
    }

    // Local-only records
    for (const [id, localRec] of localMap) {
      if (!remoteMap.has(id)) {
        mergedRecords.set(id, localRec);
        addedToRemote++;
      }
    }

    merged.records = Array.from(mergedRecords.values());

    // Merge accounts
    merged.accounts = this.mergeArrayById(local.accounts, remote.accounts);

    // Merge modules (keep remote field definitions, merge categories)
    merged.modules = remote.modules.map(remoteMod => {
      const localMod = local.modules.find(m => m.id === remoteMod.id);
      if (localMod && localMod.categories && remoteMod.categories) {
        return {
          ...remoteMod,
          categories: this.mergeArrayById(localMod.categories, remoteMod.categories),
        };
      }
      return remoteMod;
    });

    // Add any local-only modules
    for (const localMod of local.modules) {
      if (!merged.modules.find(m => m.id === localMod.id)) {
        merged.modules.push(localMod);
      }
    }

    merged.lastModified = new Date().toISOString();
    merged.deviceId = local.deviceId;

    return { data: merged, addedToRemote, addedFromRemote, updated };
  }

  /**
   * Merge two arrays of objects by 'id' field, using 'updatedAt' for conflict resolution
   */
  private mergeArrayById<T extends { id: string; updatedAt?: string; createdAt?: string }>(
    local: T[],
    remote: T[]
  ): T[] {
    const localMap = new Map<string, T>();
    for (const item of local) {
      localMap.set(item.id, item);
    }

    const remoteMap = new Map<string, T>();
    for (const item of remote) {
      remoteMap.set(item.id, item);
    }

    const merged = new Map<string, T>();

    // Add all remote items, resolve conflicts
    for (const [id, remoteItem] of remoteMap) {
      const localItem = localMap.get(id);
      if (localItem) {
        const localTime = new Date(localItem.updatedAt || localItem.createdAt || '2000-01-01').getTime();
        const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || '2000-01-01').getTime();
        merged.set(id, localTime > remoteTime ? localItem : remoteItem);
      } else {
        merged.set(id, remoteItem);
      }
    }

    // Add local-only items
    for (const [id, localItem] of localMap) {
      if (!remoteMap.has(id)) {
        merged.set(id, localItem);
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Export data as JSON file (for backup)
   */
  async exportJSON(): Promise<void> {
    const data = await indexedDBService.loadData();
    if (!data) return;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import data from JSON file
   */
  async importJSON(file: File): Promise<SyncResult> {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as FinanceData;

      // Basic validation
      if (!data.version || !data.modules || !data.records) {
        return { status: 'error', message: 'Invalid data format' };
      }

      await indexedDBService.saveData(data);
      return { status: 'success', message: 'Import successful', data };
    } catch {
      return { status: 'error', message: 'Failed to parse JSON file' };
    }
  }
}

export const syncService = new SyncService();
