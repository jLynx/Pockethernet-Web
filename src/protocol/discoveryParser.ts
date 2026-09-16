import { decodeText, formatMac } from './bytes';
import type { CdpLldpResult, FieldMap } from './types';

interface DiscoveryFrame {
  protocol: 'CDP' | 'LLDP';
  summary: string;
  fields: FieldMap;
}

function ethernetPayload(payload: Uint8Array): { type: number; offset: number; source: string } {
  if (payload.length < 14) throw new Error('Invalid Ethernet frame');
  const type = (payload[12] << 8) | payload[13];
  const offset = type === 0x8100 ? 18 : 14;
  return {
    type: type === 0x8100 ? (payload[16] << 8) | payload[17] : type,
    offset,
    source: formatMac(payload.slice(6, 12)),
  };
}

function parseCdpFrame(payload: Uint8Array, offset: number): DiscoveryFrame | null {
  const snap = [0xaa, 0xaa, 0x03, 0x00, 0x00, 0x0c, 0x20, 0x00];
  if (
    payload.length < offset + 10 ||
    !snap.every((value, index) => payload[offset + index] === value)
  )
    return null;
  const fields: FieldMap = {
    'CDP Version': String(payload[offset + 8]),
    'CDP TTL': `${payload[offset + 9]} s`,
  };
  let cursor = offset + 12;
  while (cursor + 4 <= payload.length) {
    const type = (payload[cursor] << 8) | payload[cursor + 1];
    const length = (payload[cursor + 2] << 8) | payload[cursor + 3];
    if (length < 4 || cursor + length > payload.length) break;
    const valueStart = cursor + 4;
    const valueEnd = cursor + length;
    const textField: Record<number, string> = {
      1: 'Device ID',
      3: 'Port ID',
      5: 'Software version',
      6: 'Platform',
      9: 'VTP domain',
    };
    if (textField[type]) fields[textField[type]] = decodeText(payload, valueStart, valueEnd);
    if (type === 4 && length >= 8) {
      const value =
        payload[valueStart] * 0x1000000 +
        payload[valueStart + 1] * 0x10000 +
        payload[valueStart + 2] * 0x100 +
        payload[valueStart + 3];
      fields.Capabilities = `0x${(value >>> 0).toString(16)}`;
    }
    if (type === 10 && length >= 8)
      fields['Native VLAN'] = String((payload[valueStart + 4] << 8) | payload[valueStart + 5]);
    cursor += length;
  }
  return { protocol: 'CDP', summary: 'CDP received', fields };
}

function lldpCapabilities(value: number): string {
  const names: [number, string][] = [
    [1, 'Other'],
    [2, 'Repeater'],
    [4, 'MAC Bridge'],
    [8, 'WLAN Access Point'],
    [16, 'Router'],
    [32, 'Telephone'],
    [64, 'DOCSIS Cable Device'],
    [128, 'Station'],
    [256, 'C-VLAN'],
    [512, 'S-VLAN'],
    [1024, 'Two-port MAC Relay'],
  ];
  const result = names.filter(([flag]) => value & flag).map(([, name]) => name);
  return result.length ? result.join(', ') : 'None';
}

function parseLldpFrame(payload: Uint8Array, offset: number, type: number): DiscoveryFrame | null {
  if (type !== 0x88cc && type !== 0x88e7) return null;
  const fields: FieldMap = {};
  let cursor = offset;
  while (cursor + 2 <= payload.length) {
    const header = (payload[cursor] << 8) | payload[cursor + 1];
    const tlvType = header >>> 9;
    const length = header & 0x1ff;
    if (cursor + 2 + length > payload.length) break;
    const start = cursor + 2;
    const end = start + length;
    if (tlvType === 0) break;
    if (tlvType === 1 && length > 1)
      fields['Chassis ID'] =
        payload[start] === 4 && length >= 7
          ? formatMac(payload.slice(start + 1, start + 7))
          : decodeText(payload, start + 1, end);
    if (tlvType === 2 && length > 1) fields['Port ID'] = decodeText(payload, start + 1, end);
    if (tlvType === 3 && length === 2)
      fields.TTL = `${(payload[start] << 8) | payload[start + 1]} s`;
    if (tlvType === 4) fields['Port description'] = decodeText(payload, start, end);
    if (tlvType === 5) fields['System name'] = decodeText(payload, start, end);
    if (tlvType === 6) fields['System description'] = decodeText(payload, start, end);
    if (tlvType === 7 && length >= 4) {
      fields.Capabilities = lldpCapabilities((payload[start] << 8) | payload[start + 1]);
      fields['Capabilities Enabled'] = lldpCapabilities(
        (payload[start + 2] << 8) | payload[start + 3],
      );
    }
    if (tlvType === 8 && length >= 6) {
      const addressLength = payload[start];
      const addressSubtype = payload[start + 1];
      if (addressSubtype === 1 && addressLength >= 5 && start + 6 <= end)
        fields['Management IPv4'] = Array.from(payload.slice(start + 2, start + 6)).join('.');
      else
        fields['Management Address'] = decodeText(
          payload,
          start + 2,
          Math.min(end, start + 1 + addressLength),
        );
    }
    cursor = end;
  }
  return {
    protocol: 'LLDP',
    summary: fields['System name'] ? `LLDP: ${fields['System name']}` : 'LLDP',
    fields,
  };
}

export function parseCdpLldpPacket(payload: Uint8Array): CdpLldpResult {
  const { type, offset, source } = ethernetPayload(payload);
  const frame = parseCdpFrame(payload, offset) ?? parseLldpFrame(payload, offset, type);
  if (!frame) throw new Error('Filtered Ethernet frame is neither CDP nor LLDP');
  return { ...frame, status: 'OK', source };
}
