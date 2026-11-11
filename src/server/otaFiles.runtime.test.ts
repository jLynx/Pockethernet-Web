import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Use the actual Workers HTTP runtime. A Node Response test cannot detect Workers
// silently dropping Content-Length from an ordinary ReadableStream response.
const bundled = await build({
  entryPoints: ['src/worker.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
});
const runtime = new Miniflare({
  port: 0,
  workers: [
    {
      config: {
        name: 'ota-test',
        type: 'worker',
        compatibilityDate: '2026-09-15',
        manifest: {
          mainModule: 'worker.js',
          modules: { 'worker.js': { type: 'esm', contents: bundled.outputFiles[0].text } },
        },
        env: {
          OTA_FILES: { type: 'durable-object', worker: 'ota-test', exportName: 'OtaFileStore' },
        },
        exports: { OtaFileStore: { type: 'durable-object', storage: 'sqlite' } },
      },
    },
  ],
});
try {
  const origin = (await runtime.ready).origin;
  const bytes = new Uint8Array(1276736); // Current custom-package size; synthetic, never flashed.
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x50455549, false);
  view.setUint32(8, bytes.length - 128, true);
  view.setUint32(0x10, 2, true);
  view.setUint32(0x14, 16, true);
  for (let i = 128; i < bytes.length; i++) bytes[i] = i & 255;
  const response = await fetch(`${origin}/api/ota-files`, {
    method: 'POST',
    body: bytes,
    headers: { Origin: origin, 'Content-Type': 'application/octet-stream' },
  });
  assert.equal(response.status, 201, await response.clone().text());
  const info: unknown = await response.json();
  assert.ok(info && typeof info === 'object' && 'path' in info && typeof info.path === 'string');
  assert.ok('bytes' in info && info.bytes === bytes.length);
  const download = await fetch(`${origin}${info.path}`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('Content-Length'), String(bytes.length));
  assert.equal(download.headers.get('Content-Encoding'), 'identity');
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()), bytes);
  const absent = await fetch(`${origin}/f/${'a'.repeat(22)}`);
  assert.equal(absent.status, 404, 'A different token must not reveal the uploaded file');
  const head = await fetch(`${origin}${info.path}`, { method: 'HEAD' });
  assert.equal(head.headers.get('Content-Length'), String(bytes.length));
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  const crossOrigin = await fetch(`${origin}/api/ota-files`, {
    method: 'POST',
    body: bytes,
    headers: { Origin: 'https://another.example' },
  });
  assert.equal(crossOrigin.status, 403);
  console.log(
    'Real Workers HTTP/SQLite OTA hosting: 1,276,736 bytes preserved with Content-Length.',
  );
} finally {
  await runtime.dispose();
}
