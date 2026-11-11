import assert from 'node:assert/strict';
import { loadReports } from './storage';
import { createLlmExport } from '@/features/reports/llmExport';

const values = new Map<string, string>();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const storage: Storage = {
  get length() {
    return values.size;
  },
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => {
    values.set(key, value);
  },
  removeItem: (key) => {
    values.delete(key);
  },
  clear: () => values.clear(),
  key: (index) => [...values.keys()][index] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
try {
  const base = {
    id: 'stored-report',
    createdAt: '2026-11-11T03:02:58.000Z',
    details: {
      user: '',
      address: '',
      location: '',
      portId: '',
      tag: '',
      comment: 'Long notes\n'.repeat(100),
    },
    settings: { tia: '568B', units: 'meters', nvp: '68' },
    results: {
      wiremap: null,
      tdr: null,
      tdrGraph: null,
      poe: null,
      link: null,
      ber: null,
      cdplldp: null,
      vlan: null,
      traffic: null,
      ipv4: null,
      ipv6: null,
      ping: null,
      extip: null,
    },
  };
  const photos = ['data:image/jpeg;base64,first', 'data:image/jpeg;base64,second'];
  storage.setItem(
    'pockethernet.reports',
    JSON.stringify([
      { ...base, id: 'legacy-photo', photoDataUrl: photos[0] },
      { ...base, id: 'legacy-no-photo', photoDataUrl: '' },
      { ...base, id: 'multiple-photos', photoDataUrls: photos },
      { ...base, id: 'both-fields', photoDataUrls: photos, photoDataUrl: photos[0] },
      { ...base, id: 'bad-photos', photoDataUrls: [photos[0], 123] },
      { ...base, id: 'bad-details', details: null, photoDataUrls: [] },
    ]),
  );
  const reports = loadReports();
  assert.deepEqual(
    reports.map((report) => report.id),
    ['legacy-photo', 'legacy-no-photo', 'multiple-photos', 'both-fields'],
  );
  assert.deepEqual(
    reports.map((report) => report.photoDataUrls),
    [[photos[0]], [], photos, photos],
  );
  assert.ok(
    reports.every((report) => !('photoDataUrl' in report)),
    'Migration must not duplicate image storage',
  );
  assert.equal(reports[0].details.comment, base.details.comment);
  storage.setItem('pockethernet.reports', JSON.stringify(reports));
  assert.deepEqual(loadReports(), reports, 'All attachments must survive saving and reloading');
  const exported = createLlmExport([reports[2]]);
  assert.match(exported, /"attachment_present": true/);
  assert.match(exported, /"attachment_count": 2/);
  assert.ok(!exported.includes(photos[0]), 'Clipboard summaries must not include raw image data');
  storage.setItem('pockethernet.reports', '{broken');
  assert.deepEqual(loadReports(), []);
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}
console.log('Report image migration, persistence and export regression tests passed.');
