import { bytesToIpv4, formatIpv6, formatMac } from './bytes';
import type {
  BerResult,
  DeviceInfo,
  FieldsResult,
  FirmwareVersionResult,
  PingPacketResult,
  TrafficPacketResult,
  VlanTag,
} from './types';

export function parseTrafficPacket(payload: Uint8Array): TrafficPacketResult {
  if (payload.length < 14) throw new Error('Invalid Traffic Ethernet frame');
  const source = formatMac(payload.slice(6, 12));
  const destination = formatMac(payload.slice(0, 6));
  const etherType = (payload[12] << 8) | payload[13];
  let vlanId = '';
  if (etherType === 0x8100) {
    if (payload.length < 16) throw new Error('Invalid Traffic VLAN frame');
    vlanId = String(((payload[14] << 8) | payload[15]) & 0x0fff);
  }
  return { source, destination, vlanId };
}

export function parsePingPacket(payload: Uint8Array): PingPacketResult {
  if (payload.length < 12) throw new Error('Invalid Ping response');
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const addressType = payload[11];
  const address =
    addressType === 0 && payload.length >= 16
      ? bytesToIpv4(payload, 12)
      : addressType === 6 && payload.length >= 28
        ? formatIpv6(payload.slice(12, 28))
        : '';
  const roundTrip = view.getUint16(6, true);
  if (roundTrip >= 65535) return { status: 'not_OK', ip: address, time: 'Timeout' };
  if (addressType !== 0 && addressType !== 6)
    return { status: 'not_OK', ip: 'Resolve error', time: 'Resolve error' };
  return { status: 'OK', ip: address, time: `${roundTrip} ms` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

export function parseExternalIpPacket(payload: Uint8Array): FieldsResult {
  let response: unknown;
  try {
    response = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return { status: 'not_OK', summary: 'External IP lookup failed', fields: {} };
  }
  if (
    !isRecord(response) ||
    response.status !== 'success' ||
    typeof response.query !== 'string' ||
    !response.query
  ) {
    const summary =
      isRecord(response) && typeof response.message === 'string'
        ? response.message
        : 'External IP lookup failed';
    return { status: 'not_OK', summary, fields: {} };
  }
  const location = ['city', 'region', 'country']
    .map((key) => stringField(response, key))
    .filter(Boolean)
    .join(', ');
  return {
    status: 'OK',
    summary: `External IP: ${response.query}`,
    fields: {
      IP: response.query,
      AS: stringField(response, 'as'),
      ISP: stringField(response, 'isp'),
      'Geo IP': location,
    },
  };
}

export function parseBerPacket(payload: Uint8Array, current: Partial<BerResult> = {}): BerResult {
  if (payload.length !== 12)
    throw new Error(`Invalid BER response: expected 12 bytes, received ${payload.length}`);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const sent = (current.sent ?? 0) + view.getUint32(0, true);
  const received = (current.received ?? 0) + view.getUint32(4, true);
  const errors = (current.errors ?? 0) + view.getUint32(8, true);
  const ratio = sent > 0 ? (sent - received + errors) / sent : 0;
  const errorRate =
    ratio < 0.001 ? `${(ratio * 1000000).toFixed(1)} ppm` : `${(ratio * 100).toFixed(3)}%`;
  return { sent, received, errors, ratio, errorRate, summary: `Error rate: ${errorRate}` };
}

export function isBerLinkUp(payload: Uint8Array): boolean {
  if (payload.length < 12)
    throw new Error(
      `Invalid Ethernet link response: expected at least 12 bytes, received ${payload.length}`,
    );
  return (
    (new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint16(10, true) &
      64) !==
    0
  );
}

export function parseVlanPacket(payload: Uint8Array): VlanTag[] {
  if (payload.length % 2 !== 0)
    throw new Error(
      `Invalid VLAN collection response: expected 16-bit tags, received ${payload.length} bytes`,
    );
  const tags = new Set<number>();
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  for (let offset = 0; offset < payload.length; offset += 2) {
    const tag = view.getUint16(offset, false);
    if (tag) tags.add(tag);
  }
  return Array.from(tags)
    .sort((first, second) => first - second)
    .map((tag) => ({
      id: tag & 0x0fff,
      priority: (tag >>> 13) & 7,
      dei: Boolean(tag & 0x1000),
    }));
}

export function parseDeviceInfo(payload: Uint8Array): DeviceInfo {
  if (payload.length < 35) throw new Error('Invalid device-information response');
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const deviceMac = payload.slice(29, 35);
  for (let index = deviceMac.length - 1; index >= 0; index -= 1) {
    const incremented = deviceMac[index] + 3;
    deviceMac[index] = incremented & 255;
    if (incremented <= 255) break;
  }
  return {
    serial: view.getInt32(0, true),
    hardwareVersion: view.getInt32(4, true),
    stmVersion: view.getInt32(12, true),
    espVersion: view.getInt32(24, true),
    mac: formatMac(deviceMac),
  };
}

export function parseFirmwareVersionResponse(
  response: string,
  currentVersion: number,
): FirmwareVersionResult {
  const separator = response.indexOf('#');
  const versionText = separator >= 0 ? response.slice(0, separator).trim() : '';
  const downloadUrl = separator >= 0 ? response.slice(separator + 1).trim() : '';
  const latestVersion = Number(versionText);
  if (!Number.isFinite(latestVersion) || !downloadUrl.includes('http'))
    throw new Error('Invalid response from update server');
  return {
    latestVersion,
    downloadUrl,
    updateAvailable: currentVersion < latestVersion,
    message:
      currentVersion < latestVersion
        ? `Update available: v${latestVersion}`
        : `Already running latest software: v${currentVersion}`,
  };
}
