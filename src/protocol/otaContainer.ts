// PEUI offsets mirror firmware-local/esp32-pio/include/pe_crypto.hpp.
export const OTA_CONTAINER_HEADER_BYTES = 128;
export const OTA_FILE_MAX_BYTES = 4 * 1024 * 1024;
export const OTA_FILE_LIFETIME_MS = 30 * 60 * 1000;
export interface OtaFileInfo {
  version: number;
  bytes: number;
  sha256: string;
}

/** Structural inspection only. The device authenticates, decrypts and verifies the image. */
export async function inspectOtaContainer(bytes: ArrayBuffer): Promise<OtaFileInfo> {
  if (bytes.byteLength < OTA_CONTAINER_HEADER_BYTES + 288 || bytes.byteLength > OTA_FILE_MAX_BYTES)
    throw new Error('Choose an ESP OTA package between 416 bytes and 4 MiB.');
  const view = new DataView(bytes);
  if (view.getUint32(0, false) !== 0x50455549)
    throw new Error(
      'Choose a packaged PEUI ESP OTA file (pen_e_*.bin), not raw firmware.bin or a USB flash dump.',
    );
  if (view.getUint32(0x10, true) !== 2)
    throw new Error('This is not an ESP OTA package. STM firmware files cannot be installed here.');
  const version = view.getUint32(0x14, true);
  if (
    version < 1 ||
    version > 0x7fffffff ||
    view.getUint32(0x20, true) > 1 ||
    view.getUint32(8, true) !== bytes.byteLength - OTA_CONTAINER_HEADER_BYTES
  )
    throw new Error('The OTA package has an invalid header or file length.');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return {
    version,
    bytes: bytes.byteLength,
    sha256: Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(''),
  };
}
