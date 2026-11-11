import { PACKET } from './constants';
import type { Packet } from './types';

export const ESP_UPDATE_TIMEOUT_SECONDS = 300;
export const ESP_UPDATE_RESPONSE_TIMEOUT_MS = (ESP_UPDATE_TIMEOUT_SECONDS + 10) * 1000;

/** Stock's URL buffer is smaller than the remake's: retain the 60-byte stock limit. */
export function espUpdateCommand(url: string): Packet {
  if (!/^[\x21-\x7e]{1,60}$/.test(url) || !/^https?:\/\//.test(url))
    throw new Error('Firmware URL must be an HTTP(S) address of at most 60 ASCII bytes');
  const address = new URL(url);
  if (!address.hostname || address.username || address.password || address.hash)
    throw new Error('Firmware URLs cannot contain credentials or a fragment');
  const bytes = new TextEncoder().encode(url);
  const payload = new Uint8Array(bytes.length + 4);
  new DataView(payload.buffer).setUint16(0, ESP_UPDATE_TIMEOUT_SECONDS, true);
  // protocol_pen: timeout LE u16, URL length including NUL, ASCII URL, terminating NUL.
  payload[2] = bytes.length + 1;
  payload.set(bytes, 3);
  return { type: PACKET.ESP_UPDATE, payload };
}

/** The regular update check stays restricted to the official ESP container. */
export function validateOfficialFirmwareUrl(value: string, version: number): void {
  espUpdateCommand(value);
  const url = new URL(value);
  if (
    url.origin !== 'https://ota.pockethernet.com' ||
    url.search ||
    url.hash ||
    url.pathname !== `/pen_e_crypt_${version}.bin`
  )
    throw new Error('The update server did not provide an official ESP firmware URL');
}

export function parseEspUpdateStatus(packet: Packet): number {
  if (packet.type !== PACKET.ESP_UPDATE || packet.payload.length !== 4)
    throw new Error('Invalid firmware update response');
  return new DataView(packet.payload.buffer, packet.payload.byteOffset, 4).getUint32(0, true);
}

export function espUpdateFailure(status: number): string {
  const reasons: Record<number, string> = {
    0: 'The update worker is busy or could not start',
    1: 'No firmware update partition is available',
    3: 'The device could not initialize the download client',
    11: 'The device could not connect to the server or read the firmware header',
    12: 'Firmware authentication or image validation failed',
    13: 'Writing firmware failed; the image may exceed the available app slot',
    14: 'The firmware download was interrupted',
    15: 'Final firmware verification failed',
    16: 'The device could not select the updated app for boot',
    255: 'The device stopped waiting; its update worker may still be running',
  };
  return `${reasons[status] ?? 'The device returned an unrecognized update result'} (code ${status}).`;
}
