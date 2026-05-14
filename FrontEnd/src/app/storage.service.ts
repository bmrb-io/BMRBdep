import {Injectable} from '@angular/core';

const DB_NAME = 'bmrbdep';
const DB_VERSION = 1;
const STORE = 'kv';

type StorageKey = 'entry' | 'entryID' | 'schema';

@Injectable({providedIn: 'root'})
export class StorageService {
  private readonly ready: Promise<IDBDatabase>;

  constructor() {
    this.ready = this.openDB().then(async db => {
      await this.migrateFromLocalStorage(db);
      return db;
    });
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
    const lsEntry = localStorage.getItem('entry');
    const lsEntryID = localStorage.getItem('entryID');
    const lsSchema = localStorage.getItem('schema');
    if (lsEntry === null && lsEntryID === null && lsSchema === null) {
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        if (lsEntry !== null) store.put(lsEntry, 'entry');
        if (lsEntryID !== null) store.put(lsEntryID, 'entryID');
        if (lsSchema !== null) store.put(lsSchema, 'schema');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      localStorage.removeItem('entry');
      localStorage.removeItem('entryID');
      localStorage.removeItem('schema');
    } catch (e) {
      console.error('Migration from localStorage to IndexedDB failed', e);
    }
  }

  async get(key: StorageKey): Promise<string | null> {
    const db = await this.ready;
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async set(key: StorageKey, value: string): Promise<void> {
    const db = await this.ready;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.ready;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.delete('entry');
      store.delete('entryID');
      store.delete('schema');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
