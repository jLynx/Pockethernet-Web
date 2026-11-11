import assert from 'node:assert/strict';
import { OtaFileStore, serveOtaFiles, type OtaFilesEnv, type ObjectStorage } from './otaFiles';
import { OTA_FILE_LIFETIME_MS } from '../protocol/otaContainer';

function fixture(size = 131200, type = 2): ArrayBuffer {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x50455549, false);
  view.setUint32(8, size - 128, true);
  view.setUint32(0x10, type, true);
  view.setUint32(0x14, 16, true);
  for (let i = 128; i < size; i++) bytes[i] = i & 255;
  return bytes.buffer;
}
const memory = new Map<string, unknown>();
let alarm = 0;
const storage: ObjectStorage = {
  get<T>(key: string): Promise<T | undefined> {
    // This test double stores values without serialization; production uses DO storage.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mirror DO's generic get contract in the in-memory test double.
    return Promise.resolve(memory.get(key) as T | undefined);
  },
  put(values: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(values)) memory.set(key, value);
    return Promise.resolve();
  },
  deleteAll(): Promise<void> {
    memory.clear();
    return Promise.resolve();
  },
  setAlarm(time: number): Promise<void> {
    alarm = time;
    return Promise.resolve();
  },
  transaction<T>(action: (value: ObjectStorage) => Promise<T>): Promise<T> {
    return action(storage);
  },
};
const store = new OtaFileStore({ storage, blockConcurrencyWhile: (action) => action() });
const env: OtaFilesEnv = {
  OTA_FILES: {
    idFromName: (name) => name,
    get: () => ({ fetch: (request) => store.fetch(request) }),
  },
};
const origin = 'https://pockethernet.jlynx.net';
const upload = (bytes: ArrayBuffer, suppliedOrigin = origin): Request =>
  new Request(`${origin}/api/ota-files`, {
    method: 'POST',
    headers: { Origin: suppliedOrigin, 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });
assert.equal((await serveOtaFiles(upload(fixture(), 'https://evil.test'), env)).status, 403);
assert.equal((await serveOtaFiles(upload(fixture()), {})).status, 503);
assert.equal((await serveOtaFiles(new Request(`${origin}/api/ota-files`), env)).status, 405);
assert.equal((await serveOtaFiles(upload(fixture(416, 1)), env)).status, 400);
assert.equal(memory.size, 0, 'Invalid images must not be stored');
const bytes = fixture();
const response = await serveOtaFiles(upload(bytes), env);
assert.equal(response.status, 201);
const info: unknown = await response.json();
assert.ok(info && typeof info === 'object' && 'path' in info && typeof info.path === 'string');
assert.ok(`${origin}${info.path}`.length <= 60);
assert.ok(alarm >= Date.now() + OTA_FILE_LIFETIME_MS - 5000);
assert.equal(memory.size, 4, 'Large files must be split into stock-compatible storage values');
const get = await serveOtaFiles(new Request(`${origin}${info.path}`), env);
assert.equal(get.headers.get('Content-Length'), String(bytes.byteLength));
assert.equal(get.headers.get('Content-Encoding'), 'identity');
assert.deepEqual(await get.arrayBuffer(), bytes, 'The OTA download must preserve every byte');
const head = await serveOtaFiles(new Request(`${origin}${info.path}`, { method: 'HEAD' }), env);
assert.equal(head.headers.get('Content-Length'), String(bytes.byteLength));
assert.equal((await head.arrayBuffer()).byteLength, 0);
assert.equal(
  (await serveOtaFiles(new Request(`${origin}${info.path}`, { method: 'POST' }), env)).status,
  405,
);
assert.equal(
  (await store.fetch(upload(fixture(416)))).status,
  400,
  'Stored URLs must be immutable',
);
await store.alarm();
assert.equal(memory.size, 0);
assert.equal((await serveOtaFiles(new Request(`${origin}${info.path}`), env)).status, 404);
console.log(
  'Temporary OTA hosting byte preservation, immutability, expiry and request checks passed.',
);
