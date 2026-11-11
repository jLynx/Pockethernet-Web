import {
  inspectOtaContainer,
  OTA_FILE_MAX_BYTES,
  OTA_FILE_LIFETIME_MS,
  type OtaFileInfo,
} from '../protocol/otaContainer';

export interface ObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(values: Record<string, unknown>): Promise<void>;
  deleteAll(): Promise<void>;
  setAlarm(time: number): Promise<void>;
  transaction<T>(action: (storage: ObjectStorage) => Promise<T>): Promise<T>;
}
interface ObjectState {
  storage: ObjectStorage;
  blockConcurrencyWhile<T>(action: () => Promise<T>): Promise<T>;
}
export interface OtaFilesEnv {
  OTA_FILES?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
}
interface StoredInfo extends OtaFileInfo {
  expiresAt: number;
  chunks: number;
}
const CHUNK_BYTES = 64 * 1024; // Durable Object values must stay below 128 KiB each.

async function readLimited(request: Request): Promise<ArrayBuffer> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('An OTA file is required.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > OTA_FILE_MAX_BYTES) {
        await reader.cancel();
        throw new Error('OTA files cannot exceed 4 MiB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes.buffer;
}

/** One random download link per object. Bytes expire automatically, including unused uploads. */
export class OtaFileStore {
  constructor(private readonly state: ObjectState) {}
  async fetch(request: Request): Promise<Response> {
    const storage = this.state.storage;
    if (request.method === 'POST') {
      try {
        const bytes = await readLimited(request);
        const info = await inspectOtaContainer(bytes);
        const metadata: StoredInfo = {
          ...info,
          expiresAt: Date.now() + OTA_FILE_LIFETIME_MS,
          chunks: Math.ceil(bytes.byteLength / CHUNK_BYTES),
        };
        await this.state.blockConcurrencyWhile(async () => {
          // A link is immutable, so repeated requests cannot replace a reviewed firmware file.
          if (await storage.get('info')) throw new Error('This download link already exists.');
          await storage.transaction(async (transaction) => {
            const values: Record<string, unknown> = { info: metadata };
            for (let i = 0; i < metadata.chunks; i++)
              values[`chunk${i}`] = bytes.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
            await transaction.put(values);
            await transaction.setAlarm(metadata.expiresAt);
          });
        });
        return Response.json(metadata, { status: 201, headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        return new Response(error instanceof Error ? error.message : 'OTA file upload failed.', {
          status: 400,
        });
      }
    }
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Method not allowed', { status: 405 });
    const info = await storage.get<StoredInfo>('info');
    if (!info || info.expiresAt <= Date.now()) {
      if (info) await storage.deleteAll();
      return new Response('OTA download link expired or was not found.', { status: 404 });
    }
    const headers = {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(info.bytes),
      'Cache-Control': 'no-store, no-transform',
      'Content-Encoding': 'identity',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'none',
    };
    if (request.method === 'HEAD') return new Response(null, { headers });
    // Workers ignores manually supplied Content-Length on an unknown-length stream.
    // A bounded ArrayBuffer gives it a known-length body, compatible with stock OTA.
    const body = new Uint8Array(info.bytes);
    for (let index = 0; index < info.chunks; index++) {
      const chunk = await storage.get<ArrayBuffer>(`chunk${index}`);
      if (!chunk) return new Response('OTA file storage is incomplete.', { status: 500 });
      body.set(new Uint8Array(chunk), index * CHUNK_BYTES);
    }
    return new Response(body.buffer, { headers });
  }
  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}

export async function serveOtaFiles(request: Request, env: OtaFilesEnv): Promise<Response> {
  const url = new URL(request.url);
  const token = /^\/f\/([A-Za-z0-9_-]{22})$/.exec(url.pathname)?.[1];
  const uploading = url.pathname === '/api/ota-files';
  if (!uploading && !token) return new Response('OTA file not found.', { status: 404 });
  if (
    (uploading && request.method !== 'POST') ||
    (!uploading && !['GET', 'HEAD'].includes(request.method))
  )
    return new Response('Method not allowed', { status: 405 });
  if (uploading && request.headers.get('Origin') !== url.origin)
    return new Response('OTA uploads must come from Pocketweb on this host.', { status: 403 });
  if (uploading && Number(request.headers.get('Content-Length')) > OTA_FILE_MAX_BYTES)
    return new Response('OTA files cannot exceed 4 MiB.', { status: 413 });
  if (!env.OTA_FILES)
    return new Response(
      'Temporary OTA hosting is unavailable. Deploy the Worker with its OTA_FILES binding, or use a custom URL.',
      { status: 503 },
    );
  const key =
    token ??
    btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const object = env.OTA_FILES.get(env.OTA_FILES.idFromName(key));
  const response = await object.fetch(request);
  if (!uploading || !response.ok) return response;
  const info: unknown = await response.json();
  return Response.json(
    { ...(typeof info === 'object' ? info : {}), path: `/f/${key}` },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  );
}
