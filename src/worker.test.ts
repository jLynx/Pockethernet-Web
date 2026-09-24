import assert from 'node:assert/strict';
import worker from './worker';

const origin = 'https://example.test';
const files = new Map([
  [
    '/index.html',
    {
      body: '<script type="module" src="/assets/index-new123.js"></script><link rel="stylesheet" href="/assets/index-new123.css">',
      type: 'text/html',
    },
  ],
  ['/assets/index-new123.js', { body: 'export const current = true;', type: 'text/javascript' }],
  ['/assets/index-new123.css', { body: 'body { color: red; }', type: 'text/css' }],
  ['/logo-192.png', { body: 'current icon', type: 'image/png' }],
  ['/logo-512.png', { body: 'current large icon', type: 'image/png' }],
  ['/assets/logo.png', { body: 'current wordmark', type: 'image/png' }],
]);

const env = {
  ASSETS: {
    fetch(request: Request): Promise<Response> {
      const file = files.get(new URL(request.url).pathname);
      return Promise.resolve(
        new Response(file?.body ?? '<html>SPA fallback</html>', {
          headers: { 'Content-Type': file?.type ?? 'text/html' },
        }),
      );
    },
  },
};

async function get(path: string): Promise<Response> {
  return worker.fetch(new Request(new URL(path, origin)), env);
}

const oldScript = await get('/assets/index-IHmIBy5Q.js');
assert.equal(oldScript.headers.get('Content-Type'), 'text/javascript');
assert.equal(oldScript.headers.get('Cache-Control'), 'no-store');
assert.equal(await oldScript.text(), 'export const current = true;');

const oldStyle = await get('/assets/index-old456.css');
assert.equal(oldStyle.headers.get('Content-Type'), 'text/css');
assert.equal(await oldStyle.text(), 'body { color: red; }');

for (const size of [192, 512]) {
  const oldIcon = await get(`/pockethernet-${size}.png`);
  assert.equal(oldIcon.headers.get('Content-Type'), 'image/png');
  assert.equal(oldIcon.headers.get('Cache-Control'), 'no-store');
}

const oldLogo = await get('/assets/logo-B82RYX1l.png');
assert.equal(oldLogo.headers.get('Content-Type'), 'image/png');
assert.equal(oldLogo.headers.get('Cache-Control'), 'no-store');
assert.equal(await oldLogo.text(), 'current wordmark');

const currentScript = await get('/assets/index-new123.js');
assert.equal(currentScript.headers.get('Cache-Control'), null);
assert.equal(await currentScript.text(), 'export const current = true;');

files.delete('/assets/index-new123.js');
const missingCurrentScript = await get('/assets/index-old456.js');
assert.equal(missingCurrentScript.status, 404);

console.log('Legacy PWA asset recovery tests passed');
