import { openDB, type IDBPDatabase } from 'idb';
import type { FinanceData } from '@/types';

const DB_NAME = 'PersonalDataPlatform';
const DB_VERSION = 1;
const STORE_NAME = 'appData';
const DATA_KEY = 'finance_data';

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

  async saveData(data: FinanceData): Promise<void> {
    const db = await this.getDB();
    await db.put(STORE_NAME, data, DATA_KEY);
  }

  async loadData(): Promise<FinanceData | null> {
    const db = await this.getDB();
    const data = await db.get(STORE_NAME, DATA_KEY);
    return data as FinanceData | null;
  }

  async clearData(): Promise<void> {
    const db = await this.getDB();
    await db.delete(STORE_NAME, DATA_KEY);
  }

  async getLastModified(): Promise<string | null> {
    const data = await this.loadData();
    return data?.lastModified || null;
  }
}

export const indexedDBService = new IndexedDBService();
