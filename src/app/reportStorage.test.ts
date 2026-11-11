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
  const describedPhotos = [
    { dataUrl: photos[0], description: 'Switch port 24\nConnected to patch panel A.' },
    {
      dataUrl: photos[1],
      description: 'Access point installation\n' + 'Long explanation. '.repeat(60),
    },
  ];
  storage.setItem(
    'pockethernet.reports',
    JSON.stringify([
      { ...base, id: 'legacy-photo', photoDataUrl: photos[0] },
      { ...base, id: 'legacy-no-photo', photoDataUrl: '' },
      { ...base, id: 'multiple-photos', photoDataUrls: photos },
      { ...base, id: 'both-fields', photoDataUrls: photos, photoDataUrl: photos[0] },
      { ...base, id: 'described-photos', photos: describedPhotos },
      { ...base, id: 'optional-description', photos: [{ dataUrl: photos[0] }] },
      { ...base, id: 'new-photos-preferred', photos: describedPhotos, photoDataUrls: photos },
      { ...base, id: 'bad-photos', photoDataUrls: [photos[0], 123] },
      { ...base, id: 'bad-description', photos: [{ dataUrl: photos[0], description: 123 }] },
      { ...base, id: 'bad-details', details: null, photoDataUrls: [] },
    ]),
  );
  const reports = loadReports();
  assert.deepEqual(
    reports.map((report) => report.id),
    [
      'legacy-photo',
      'legacy-no-photo',
      'multiple-photos',
      'both-fields',
      'described-photos',
      'optional-description',
      'new-photos-preferred',
    ],
  );
  assert.deepEqual(
    reports.map((report) => report.photos),
    [
      [{ dataUrl: photos[0], description: '' }],
      [],
      photos.map((dataUrl) => ({ dataUrl, description: '' })),
      photos.map((dataUrl) => ({ dataUrl, description: '' })),
      describedPhotos,
      [{ dataUrl: photos[0], description: '' }],
      describedPhotos,
    ],
  );
  assert.ok(
    reports.every((report) => !('photoDataUrl' in report) && !('photoDataUrls' in report)),
    'Migration must not duplicate image storage',
  );
  assert.equal(reports[0].details.comment, base.details.comment);
  storage.setItem('pockethernet.reports', JSON.stringify(reports));
  assert.deepEqual(loadReports(), reports, 'All attachments must survive saving and reloading');
  const exported = createLlmExport([reports[2]]);
  assert.match(exported, /"attachment_present": true/);
  assert.match(exported, /"attachment_count": 2/);
  assert.ok(!exported.includes(photos[0]), 'Clipboard summaries must not include raw image data');
  const describedExport = createLlmExport([reports[4]]);
  assert.match(describedExport, /"image_number": 1/);
  assert.match(describedExport, /"image_number": 2/);
  for (const photo of describedPhotos)
    assert.ok(
      describedExport.includes(JSON.stringify(photo.description)),
      'Export full multiline descriptions',
    );
  assert.ok(!describedExport.includes(photos[0]), 'Descriptions must not expose raw photo data');
  storage.setItem('pockethernet.reports', '{broken');
  assert.deepEqual(loadReports(), []);
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}
console.log('Report image migration, persistence and export regression tests passed.');
