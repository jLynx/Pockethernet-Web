const ESP_ADDRESSES = [0x20000, 0x16000] as const;
const MAX_FLASH_BYTES = 16 * 1024 * 1024;
export const STM_HEADER_SIZE = 128;

interface ImageDescriptor {
  file: string;
  size: number;
  sha256: string;
}

export interface FirmwareManifest {
  source: URL;
  version: number;
  page: string;
  files: [ImageDescriptor, ImageDescriptor, ImageDescriptor];
}

export interface FirmwareImages {
  esp: { address: number; data: Uint8Array<ArrayBuffer> }[];
  stm: Uint8Array<ArrayBuffer>;
}

function isImageDescriptor(value: unknown): value is ImageDescriptor {
  return (
    typeof value === 'object' &&
    value !== null &&
    'file' in value &&
    typeof value.file === 'string' &&
    /^images\/[A-Za-z0-9][\w.-]*\.bin$/.test(value.file) &&
    'size' in value &&
    typeof value.size === 'number' &&
    Number.isSafeInteger(value.size) &&
    value.size > 0 &&
    'sha256' in value &&
    typeof value.sha256 === 'string' &&
    /^[a-f\d]{64}$/.test(value.sha256)
  );
}

export async function loadManifest(source: URL): Promise<FirmwareManifest> {
  const response = await fetch(source, {
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Firmware manifest returned HTTP ${response.status}.`);
  const manifest: unknown = await response.json();
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('version' in manifest) ||
    typeof manifest.version !== 'number' ||
    !Number.isSafeInteger(manifest.version) ||
    manifest.version <= 0 ||
    !('page' in manifest) ||
    typeof manifest.page !== 'string' ||
    !('files' in manifest) ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 3
  ) {
    throw new Error('Unexpected firmware manifest format.');
  }
  const files: readonly unknown[] = manifest.files;
  const [esp, espAux, stm] = files;
  if (
    !isImageDescriptor(esp) ||
    !isImageDescriptor(espAux) ||
    !isImageDescriptor(stm) ||
    new Set([esp.file, espAux.file, stm.file]).size !== 3 ||
    esp.size > MAX_FLASH_BYTES - ESP_ADDRESSES[0] ||
    espAux.size > ESP_ADDRESSES[0] - ESP_ADDRESSES[1] ||
    stm.size <= STM_HEADER_SIZE ||
    stm.size > MAX_FLASH_BYTES ||
    (stm.size - STM_HEADER_SIZE) % 8 !== 0
  ) {
    throw new Error('Unexpected firmware image list.');
  }
  return { source, version: manifest.version, page: manifest.page, files: [esp, espAux, stm] };
}

async function fetchImage(image: ImageDescriptor, source: URL): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(new URL(image.file, source), {
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`${image.file} returned HTTP ${response.status}.`);
  }
  const data = new Uint8Array(image.size);
  const reader = response.body.getReader();
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (received + value.length > data.length) {
        throw new Error(`${image.file} exceeded its expected size.`);
      }
      data.set(value, received);
      received += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (received !== image.size) throw new Error(`${image.file} has the wrong size.`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const sha256 = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (sha256 !== image.sha256) throw new Error(`${image.file} failed its SHA-256 check.`);
  return data;
}

async function downloadImage(
  image: ImageDescriptor,
  source: URL,
  log: (message: string) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    return await fetchImage(image, source);
  } catch (error) {
    log(`Retrying ${image.file}: ${describeError(error)}`);
    return fetchImage(image, source);
  }
}

export async function loadImages(
  manifest: FirmwareManifest,
  log: (message: string) => void,
): Promise<FirmwareImages> {
  const [esp, espAux, stm] = await Promise.all(
    manifest.files.map((image) => downloadImage(image, manifest.source, log)),
  );
  const header = new DataView(stm.buffer, stm.byteOffset, STM_HEADER_SIZE);
  if (
    header.getUint32(0) !== 0x50455549 || // PEUI
    header.getUint32(8, true) !== stm.length - STM_HEADER_SIZE ||
    header.getUint32(0x10, true) !== 1 ||
    header.getUint32(0x14, true) !== manifest.version
  ) {
    throw new Error('The USB package does not contain a matching STM firmware image.');
  }
  return {
    esp: [
      { address: ESP_ADDRESSES[0], data: esp },
      { address: ESP_ADDRESSES[1], data: espAux },
    ],
    stm,
  };
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
