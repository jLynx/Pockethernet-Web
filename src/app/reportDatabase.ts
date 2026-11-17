import type { SavedReport } from './types';
import { isSavedReport, loadReports } from './storage';

const DATABASE = 'pockethernet-reports';
const STORE = 'reports';
const BACKUPS = 'migrationBackups';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      if (!request.result.objectStoreNames.contains(BACKUPS))
        request.result.createObjectStore(BACKUPS, { autoIncrement: true });
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open report storage.'));
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close other Pocketweb tabs to open report storage.'));
    };
  });
}

async function transaction(
  action: (store: IDBObjectStore, backups: IDBObjectStore) => void,
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction([STORE, BACKUPS], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Report storage transaction was cancelled.'));
      tx.onerror = () => reject(tx.error ?? new Error('Could not write report storage.'));
      try {
        action(tx.objectStore(STORE), tx.objectStore(BACKUPS));
      } catch (error) {
        tx.abort();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  } finally {
    database.close();
  }
}

export async function readReportDatabase(): Promise<SavedReport[]> {
  const original = localStorage.getItem('pockethernet.reports');
  const legacy = loadReports();
  if (original !== null) {
    const preferences: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith('pockethernet.') && key !== 'pockethernet.reports') {
        const value = localStorage.getItem(key);
        if (value !== null) preferences[key] = value;
      }
    }
    await transaction((store, backups) => {
      // An unchanged recovery source must not restore reports the user subsequently deleted.
      const cursorRequest = backups.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        const backup: unknown = cursor?.value;
        if (
          backup &&
          typeof backup === 'object' &&
          'reports' in backup &&
          backup.reports === original
        )
          return;
        if (cursor) {
          cursor.continue();
          return;
        }
        backups.add({ reports: original, preferences, migratedAt: new Date().toISOString() });
        for (const report of legacy) {
          const request = store.getKey(report.id);
          request.onsuccess = () => {
            if (request.result === undefined) store.add(report);
          };
        }
      };
    });
    // Preserve a concurrent write by an older tab; it can be migrated on the next load.
    const parsed = ((): unknown => {
      try {
        return JSON.parse(original);
      } catch {
        return null;
      }
    })();
    if (
      Array.isArray(parsed) &&
      parsed.length === legacy.length &&
      localStorage.getItem('pockethernet.reports') === original
    )
      localStorage.removeItem('pockethernet.reports');
  }
  const database = await openDatabase();
  try {
    return await new Promise<SavedReport[]>((resolve, reject) => {
      const tx = database.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).getAll();
      tx.oncomplete = () => {
        const reports: unknown = request.result;
        if (!Array.isArray(reports) || !reports.every(isSavedReport)) {
          reject(
            new Error(
              'Report storage contains an unreadable report. Existing data has been retained.',
            ),
          );
          return;
        }
        resolve(reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      };
      tx.onabort = () => reject(tx.error ?? new Error('Could not load reports.'));
      tx.onerror = () => reject(tx.error ?? new Error('Could not load reports.'));
    });
  } finally {
    database.close();
  }
}

export function writeReportDatabase(report: SavedReport): Promise<void> {
  return transaction((store) => {
    store.add(report);
  });
}

export function deleteReportDatabase(id: string): Promise<void> {
  return transaction((store) => {
    store.delete(id);
  });
}

export function clearReportDatabase(): Promise<void> {
  return transaction((store, backups) => {
    store.clear();
    backups.clear();
  });
}
