import { espUpdateCommand } from '@/pockethernetProtocol';
import type { OtaFileInfo } from '@/protocol/otaContainer';

export function otaDownloadOrigin(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Download host must be an HTTP(S) origin, without a path or credentials.');
  if (
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.localhost') ||
    url.hostname === '[::1]' ||
    /^127\./.test(url.hostname) ||
    url.hostname === '0.0.0.0'
  )
    throw new Error(
      'Pockethernet cannot download from your browser’s localhost. Use the public Pocketweb host or a LAN address for the local Worker.',
    );
  // An upload token occupies 25 bytes: /f/ plus 22 base64url characters.
  espUpdateCommand(`${url.origin}/f/${'a'.repeat(22)}`);
  return url.origin;
}

/** Upload only on the explicit Start action, after the user reviews the file and hosting. */
export async function uploadOtaFile(
  file: File,
  info: OtaFileInfo,
  origin: string,
  signal: AbortSignal,
): Promise<string> {
  const host = otaDownloadOrigin(origin);
  const response = await fetch('/api/ota-files', {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': 'application/octet-stream' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
  });
  if (!response.ok)
    throw new Error((await response.text()) || `OTA file upload failed (${response.status}).`);
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    !('path' in value) ||
    typeof value.path !== 'string' ||
    !/^\/f\/[A-Za-z0-9_-]{22}$/.test(value.path) ||
    !('sha256' in value) ||
    value.sha256 !== info.sha256 ||
    !('version' in value) ||
    value.version !== info.version ||
    !('bytes' in value) ||
    value.bytes !== info.bytes ||
    !('expiresAt' in value) ||
    typeof value.expiresAt !== 'number' ||
    value.expiresAt < Date.now() + 6 * 60 * 1000
  )
    throw new Error('The temporary OTA file could not be verified. No device update was started.');
  const url = `${host}${value.path}`;
  espUpdateCommand(url);
  return url;
}
