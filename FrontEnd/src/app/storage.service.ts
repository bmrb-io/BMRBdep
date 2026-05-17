import {Injectable} from '@angular/core';

const DB_NAME = 'bmrbdep';
const DB_VERSION = 1;
const STORE = 'kv';

const ENTRY_PREFIX = 'entry:';
const SCHEMA_PREFIX = 'schema:';
const OPEN_DEPOSITIONS_KEY = 'openDepositions';

const LEGACY_ENTRY_KEY = 'entry';
const LEGACY_ENTRY_ID_KEY = 'entryID';
const LEGACY_SCHEMA_KEY = 'schema';

export interface OpenDepositionRecord {
  entryID: string;
  schemaVersion: string;
  nickname: string | null;
  deposited: boolean;
  bmrbnum: number | null;
}

@Injectable({providedIn: 'root'})
export class StorageService {
  private readonly ready: Promise<IDBDatabase>;
  private migrated = false;

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
    const lsEntry = localStorage.getItem(LEGACY_ENTRY_KEY);
    const lsEntryID = localStorage.getItem(LEGACY_ENTRY_ID_KEY);
    const lsSchema = localStorage.getItem(LEGACY_SCHEMA_KEY);
    if (lsEntry === null && lsEntryID === null && lsSchema === null) {
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        if (lsEntry !== null) store.put(lsEntry, LEGACY_ENTRY_KEY);
        if (lsEntryID !== null) store.put(lsEntryID, LEGACY_ENTRY_ID_KEY);
        if (lsSchema !== null) store.put(lsSchema, LEGACY_SCHEMA_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      localStorage.removeItem(LEGACY_ENTRY_KEY);
      localStorage.removeItem(LEGACY_ENTRY_ID_KEY);
      localStorage.removeItem(LEGACY_SCHEMA_KEY);
    } catch (e) {
      console.error('Migration from localStorage to IndexedDB failed', e);
    }
  }

  // Per-deposition entry payload (schema field stripped before write).
  async getEntry(entryID: string): Promise<string | null> {
    return this.getRaw(ENTRY_PREFIX + entryID);
  }

  async setEntry(entryID: string, json: string): Promise<void> {
    return this.setRaw(ENTRY_PREFIX + entryID, json);
  }

  async deleteEntry(entryID: string): Promise<void> {
    return this.deleteRaw(ENTRY_PREFIX + entryID);
  }

  // Schema is keyed by version so multiple depositions on the same version share storage.
  async getSchema(version: string): Promise<string | null> {
    return this.getRaw(SCHEMA_PREFIX + version);
  }

  async setSchema(version: string, json: string): Promise<void> {
    return this.setRaw(SCHEMA_PREFIX + version, json);
  }

  async hasSchema(version: string): Promise<boolean> {
    return (await this.getRaw(SCHEMA_PREFIX + version)) !== null;
  }

  // Per-browser open-deposition index. Triggers lazy v1→v2 migration if needed.
  async getOpenDepositions(): Promise<OpenDepositionRecord[]> {
    await this.runLazyMigration();
    const raw = await this.getRaw(OPEN_DEPOSITIONS_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as OpenDepositionRecord[] : [];
    } catch {
      console.error('Corrupt openDepositions index in IndexedDB; resetting.');
      return [];
    }
  }

  async setOpenDepositions(list: OpenDepositionRecord[]): Promise<void> {
    return this.setRaw(OPEN_DEPOSITIONS_KEY, JSON.stringify(list));
  }

  /**
   * Lazy upgrade from the single-deposition layout (legacy keys: 'entry',
   * 'entryID', 'schema') to the multi-deposition layout. Runs at most once
   * per service instance; idempotent across reloads because it deletes the
   * legacy keys when done.
   */
  private async runLazyMigration(): Promise<void> {
    if (this.migrated) {
      return;
    }
    this.migrated = true;

    const [legacyEntry, legacySchema] = await Promise.all([
      this.getRaw(LEGACY_ENTRY_KEY),
      this.getRaw(LEGACY_SCHEMA_KEY),
    ]);
    if (!legacyEntry || !legacySchema) {
      return;
    }
    try {
      const entryJson = JSON.parse(legacyEntry);
      const schemaJson = JSON.parse(legacySchema);
      const entryID = entryJson.entry_id as string | undefined;
      const schemaVersion = schemaJson.version as string | undefined;
      if (!entryID || !schemaVersion) {
        return;
      }
      // Strip schema from the entry JSON — schema is stored separately now.
      delete entryJson.schema;
      const record: OpenDepositionRecord = {
        entryID,
        schemaVersion,
        nickname: entryJson.deposition_nickname ?? null,
        deposited: !!entryJson.entry_deposited,
        bmrbnum: entryJson.bmrbnum ?? null,
      };
      await Promise.all([
        this.setRaw(ENTRY_PREFIX + entryID, JSON.stringify(entryJson)),
        this.setRaw(SCHEMA_PREFIX + schemaVersion, legacySchema),
        this.setRaw(OPEN_DEPOSITIONS_KEY, JSON.stringify([record])),
      ]);
      await Promise.all([
        this.deleteRaw(LEGACY_ENTRY_KEY),
        this.deleteRaw(LEGACY_ENTRY_ID_KEY),
        this.deleteRaw(LEGACY_SCHEMA_KEY),
      ]);
    } catch (e) {
      console.error('Lazy migration to multi-deposition layout failed', e);
    }
  }

  private async getRaw(key: string): Promise<string | null> {
    const db = await this.ready;
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  private async setRaw(key: string, value: string): Promise<void> {
    const db = await this.ready;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async deleteRaw(key: string): Promise<void> {
    const db = await this.ready;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
