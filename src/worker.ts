const LATEST_VERSION_URL = 'https://ota.pockethernet.com/latest_version';

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/api/latest-version') return env.ASSETS.fetch(request);
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
