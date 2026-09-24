const LATEST_VERSION_URL = 'https://ota.pockethernet.com/latest_version';

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

async function serveLegacyAsset(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const icon = /^\/pockethernet-(192|512)\.png$/.exec(url.pathname);
  const entry = /^\/assets\/index-[\w-]+\.(js|css)$/.exec(url.pathname);
  if (!icon && !entry) return env.ASSETS.fetch(request);

  const original = await env.ASSETS.fetch(request);
  if (original.ok && !original.headers.get('Content-Type')?.includes('text/html')) return original;

  let currentPath = icon ? `/logo-${icon[1]}.png` : '';
  if (entry) {
    const index = await env.ASSETS.fetch(new Request(new URL('/index.html', url)));
    if (!index.ok) return new Response('Asset not found', { status: 404 });
    currentPath =
      (await index.text()).match(new RegExp(`/assets/index-[\\w-]+\\.${entry[1]}`))?.[0] ?? '';
  }
  if (!currentPath) return new Response('Asset not found', { status: 404 });

  const current = await env.ASSETS.fetch(new Request(new URL(currentPath, url)));
  if (!current.ok || current.headers.get('Content-Type')?.includes('text/html'))
    return new Response('Asset not found', { status: 404 });
  const headers = new Headers(current.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(current.body, { status: current.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/api/latest-version') return serveLegacyAsset(request, env);
    if (request.method !== 'GET')
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });

    try {
      const upstream = await fetch(LATEST_VERSION_URL, { headers: { Accept: 'text/plain' } });
      const headers = new Headers(upstream.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('Content-Type', 'text/plain; charset=utf-8');
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    } catch {
      return new Response('Could not reach the update server', { status: 502 });
    }
  },
};
