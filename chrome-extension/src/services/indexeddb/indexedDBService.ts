import { openDB, type IDBPDatabase } from 'idb';
import type { FinanceData } from '@/types';
import { cryptoService, type EncryptedEnvelope } from '@/services/crypto/cryptoService';

const DB_NAME = 'PersonalDataPlatform';
const DB_VERSION = 1;
const STORE_NAME = 'appData';
const DATA_KEY = 'finance_data';

/** Thrown when data is encrypted but no key is loaded (needs PIN unlock). */
export class LockedError extends Error {
  constructor() { super('DATA_LOCKED'); this.name = 'LockedError'; }
}

class IndexedDBService {
  private db: IDBPDatabase | null = null;

  private async getDB(): Promise<IDBPDatabase> {
    if (this.db) return this.db;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });

    return this.db;
  }

  /**
   * Save data. If PIN encryption is enabled AND a key is loaded, the blob is
   * encrypted at rest (AES-GCM). Otherwise stored as plaintext (default).
   */
  async saveData(data: FinanceData): Promise<void> {
    const db = await this.getDB();
    if (cryptoService.isEnabled() && cryptoService.hasKey()) {
      const envelope = await cryptoService.encryptData(data);
      await db.put(STORE_NAME, envelope, DATA_KEY);
    } else {
      await db.put(STORE_NAME, data, DATA_KEY);
    }
  }

  /**
   * Load data. Returns:
   * - null if no data stored
   * - decrypted FinanceData if encrypted + key loaded
   * - plaintext FinanceData if not encrypted
   * Throws LockedError if data is encrypted but no key is loaded.
   */
  async loadData(): Promise<FinanceData | null> {
    const db = await this.getDB();
    const stored = await db.get(STORE_NAME, DATA_KEY);
    if (!stored) return null;

    if (cryptoService.isEncryptedEnvelope(stored)) {
      if (!cryptoService.isEnabled()) {
        // Encryption disabled but stale encrypted data found — clear it.
        await db.delete(STORE_NAME, DATA_KEY);
        return null;
      }
      if (!cryptoService.hasKey()) throw new LockedError();
      try {
        return await cryptoService.decryptData<FinanceData>(stored as EncryptedEnvelope);
      } catch {
        return null;
      }
    }
    return stored as FinanceData;
  }

  async clearData(): Promise<void> {
    const db = await this.getDB();
    await db.delete(STORE_NAME, DATA_KEY);
  }

  async getLastModified(): Promise<string | null> {
    try {
      const data = await this.loadData();
      return data?.lastModified || null;
    } catch {
      return null; // locked
    }
  }
}

export const indexedDBService = new IndexedDBService();
