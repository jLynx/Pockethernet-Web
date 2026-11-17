import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import {
  clearReportDatabase,
  deleteReportDatabase,
  readReportDatabase,
  writeReportDatabase,
} from './reportDatabase';
import { memoryStorage, workflowReport } from './workflowFixtures';

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage() });
});

void test('legacy reports migrate with metadata, results, all photos and descriptions; settings survive', async () => {
  const report = workflowReport();
  const { photos, ...legacy } = report;
  const { project: omitted, ...oldDetails } = report.details;
  assert.equal(omitted, 'School');
  const records = [
    { ...legacy, details: oldDetails, id: 'single', photoDataUrl: photos[0].dataUrl },
    {
      ...legacy,
      id: 'multiple',
      photoDataUrls: [photos[0].dataUrl, 'data:image/png;base64,second'],
    },
    { ...report, id: 'descriptions' },
  ];
  localStorage.setItem('pockethernet.reports', JSON.stringify(records));
  localStorage.setItem('pockethernet.toolSettings', '{"nvp":"68","units":"feet"}');
  const migrated = await readReportDatabase();
  assert.equal(migrated.length, 3);
  assert.deepEqual(migrated.find((item) => item.id === 'single')!.photos, [
    { dataUrl: photos[0].dataUrl, description: '' },
  ]);
  assert.equal(migrated.find((item) => item.id === 'single')!.details.project, '');
  assert.equal(migrated.find((item) => item.id === 'multiple')!.photos.length, 2);
  assert.deepEqual(
    migrated.find((item) => item.id === 'descriptions'),
    report.id === 'descriptions' ? report : { ...report, id: 'descriptions' },
  );
  assert.equal(localStorage.getItem('pockethernet.reports'), null);
  assert.equal(localStorage.getItem('pockethernet.toolSettings'), '{"nvp":"68","units":"feet"}');
  assert.deepEqual(await readReportDatabase(), migrated);
});

void test('a repeated migration keeps an existing IndexedDB report rather than overwriting it', async () => {
  const stored = workflowReport();
  await writeReportDatabase(stored);
  localStorage.setItem(
    'pockethernet.reports',
    JSON.stringify([{ ...stored, details: { ...stored.details, comment: 'Older copy' } }]),
  );
  assert.deepEqual(await readReportDatabase(), [stored]);
  assert.equal(localStorage.getItem('pockethernet.reports'), null);
});

void test('unrecognized legacy records are retained for recovery instead of silently discarded', async () => {
  const original = JSON.stringify([
    workflowReport(),
    { id: 'unrecognized', customData: 'Keep this' },
  ]);
  localStorage.setItem('pockethernet.reports', original);
  assert.equal((await readReportDatabase()).length, 1);
  assert.equal(localStorage.getItem('pockethernet.reports'), original);
  const backups: unknown = await new Promise((resolve, reject) => {
    const opening = indexedDB.open('pockethernet-reports', 2);
    opening.onerror = () => reject(opening.error ?? new Error('Failed to read recovery backup'));
    opening.onsuccess = () => {
      const database = opening.result;
      const tx = database.transaction('migrationBackups', 'readonly');
      const request = tx.objectStore('migrationBackups').getAll();
      tx.oncomplete = () => {
        const saved: unknown = request.result;
        database.close();
        resolve(saved);
      };
      tx.onabort = () => {
        database.close();
        reject(tx.error ?? new Error('Backup read aborted'));
      };
    };
  });
  assert.ok(Array.isArray(backups));
  const backup: unknown = backups[0];
  assert.ok(backup && typeof backup === 'object' && 'reports' in backup);
  assert.equal(backup.reports, original);
});

void test('migration does not erase reports written concurrently by an older tab', async () => {
  const storage = memoryStorage(),
    originalGet = storage.getItem.bind(storage);
  const initial = JSON.stringify([workflowReport()]);
  const updated = JSON.stringify([workflowReport(), workflowReport('second', 'CAB-002')]);
  storage.setItem('pockethernet.reports', initial);
  let reads = 0;
  storage.getItem = (key) => {
    if (key === 'pockethernet.reports' && ++reads === 3) storage.setItem(key, updated);
    return originalGet(key);
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  assert.equal((await readReportDatabase()).length, 1);
  assert.equal(storage.getItem('pockethernet.reports'), updated);
  assert.equal((await readReportDatabase()).length, 2);
  assert.equal(storage.getItem('pockethernet.reports'), null);
});

void test('retained recovery sources do not restore subsequently deleted reports', async () => {
  const report = workflowReport();
  const original = JSON.stringify([report, { unrecognized: 'Preserve me' }]);
  localStorage.setItem('pockethernet.reports', original);
  assert.equal((await readReportDatabase()).length, 1);
  await deleteReportDatabase(report.id);
  assert.deepEqual(await readReportDatabase(), []);
  assert.equal(localStorage.getItem('pockethernet.reports'), original);
});

void test('failed migration retains every legacy report and rolls back partial writes', async () => {
  const report = workflowReport();
  const legacy = JSON.stringify([report, report]);
  localStorage.setItem('pockethernet.reports', legacy);
  await assert.rejects(readReportDatabase());
  assert.equal(localStorage.getItem('pockethernet.reports'), legacy);
  localStorage.removeItem('pockethernet.reports');
  assert.deepEqual(await readReportDatabase(), []);
});

void test('batch writes, failed saves, deletion and reset keep report storage consistent', async () => {
  for (let index = 0; index < 100; index++)
    await writeReportDatabase(workflowReport(`report-${index}`, `CAB-${index}`));
  assert.equal((await readReportDatabase()).length, 100);
  await assert.rejects(writeReportDatabase(workflowReport('report-0', 'Changed')));
  assert.equal(
    (await readReportDatabase()).find((item) => item.id === 'report-0')!.details.tag,
    'CAB-0',
  );
  await deleteReportDatabase('report-0');
  assert.equal((await readReportDatabase()).length, 99);
  await clearReportDatabase();
  assert.deepEqual(await readReportDatabase(), []);
});
