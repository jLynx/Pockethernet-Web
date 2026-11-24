import { bytesToIpv4, decodeText, formatMac } from './bytes';
import { PACKET } from './constants';
import { firmwareSupports } from './firmwareFeatures';
import type { Packet } from './types';

const METHODS = [
  [1, 'ARP'],
  [2, 'ICMP'],
  [4, 'mDNS'],
  [8, 'SSDP'],
  [16, 'NetBIOS'],
  [32, 'Reverse DNS'],
  [64, 'Listen'],
  [128, 'Art-Net'],
  [512, 'EtherNet/IP'],
  [1024, 'PROFINET'],
  [4096, 'ONVIF'],
  [8192, 'Camera vendor discovery'],
  [65536, 'BACnet'],
  [262144, 'KNX'],
] as const;
const LISTEN = 64;
const BASELINE_METHODS = 0x7f;
const ADVANCED_METHODS = 128 | 512 | 1024 | 4096 | 8192 | 65536 | 262144;
const PROFINET = 1024;
export const DEFAULT_DISCOVERY_PROBES = 2 | 4 | 8 | 16 | 32;
export const DISCOVERY_PROBES = [
  { bit: 2, label: 'Ping', group: 'ipv4' },
  { bit: 4, label: 'mDNS', group: 'ipv4' },
  { bit: 8, label: 'SSDP', group: 'ipv4' },
  { bit: 16, label: 'NetBIOS', group: 'ipv4' },
  { bit: 32, label: 'Reverse DNS', group: 'ipv4' },
  { bit: PROFINET, label: 'PROFINET DCP', group: 'layer2' },
  { bit: 512, label: 'EtherNet/IP', group: 'device' },
  { bit: 262144, label: 'KNX', group: 'device' },
  { bit: 8192, label: 'Camera vendors', group: 'device' },
  { bit: 128, label: 'Art-Net', group: 'device' },
  { bit: 4096, label: 'ONVIF', group: 'device' },
  { bit: 65536, label: 'BACnet', group: 'device' },
] as const;
const BACNET_PORT = 47808;
const MDNS_TYPES = [
  '_http._tcp',
  '_ipp._tcp',
  '_printer._tcp',
  '_smb._tcp',
  '_ssh._tcp',
  '_googlecast._tcp',
  '_airplay._tcp',
  '_raop._tcp',
  '_workstation._tcp',
  '_device-info._tcp',
  '_netaudio-arc._udp',
  '_ndi._tcp',
  '_pjlink._tcp',
  '_ravenna._tcp',
  '_rtsp._tcp',
  '_osc._udp',
];

export function discoveryMethods(mask: number): string[] {
  return METHODS.filter(([bit]) => mask & bit).map(([, name]) => name);
}

export function discoveryStartCommand(
  token: number,
  active: boolean,
  espVersion: number | undefined,
  timeoutMs: number,
  probeMask = active ? BASELINE_METHODS | ADVANCED_METHODS : 0,
): Packet {
  const advanced = firmwareSupports(espVersion, 'advancedDiscovery');
  const methods =
    LISTEN |
    (active ? 1 | (probeMask & DEFAULT_DISCOVERY_PROBES) : 0) |
    (advanced ? probeMask & (active ? ADVANCED_METHODS : PROFINET) : 0);
  const hasExtendedTail = advanced && (active || (methods & PROFINET) !== 0);
  const types = methods & 4 ? MDNS_TYPES : [];
  const encoder = new TextEncoder();
  const tail = [types.length, ...types.flatMap((type) => [type.length, ...encoder.encode(type)])];
  const payload = new Uint8Array(8 + tail.length + (hasExtendedTail ? 4 : 0));
  const view = dataView(payload);
  payload.set([1, token]);
  view.setUint16(2, methods & 0xffff, true);
  view.setUint16(4, 256, true);
  view.setUint16(6, timeoutMs, true);
  payload.set(tail, 8);
  if (hasExtendedTail) {
    view.setUint16(8 + tail.length, methods >>> 16, true);
    view.setUint16(10 + tail.length, BACNET_PORT, true);
  }
  return { type: PACKET.DISCOVERY_START, payload };
}

export function discoveryAbortCommand(token: number): Packet {
  return { type: PACKET.DISCOVERY_ABORT, payload: Uint8Array.of(token) };
}

export interface DiscoveryHost {
  ip: string;
  mac?: string;
  vendor?: string;
  methods: number;
  identity: Record<string, string>;
  services: string[];
  devices: Record<string, Record<string, string | number>>;
  unknown: { type: number; hex: string }[];
}

export interface DiscoveryProgress {
  methodsDone: number;
  hosts: number;
  probed: number;
  total: number;
}

export interface DiscoveryDone extends DiscoveryProgress {
  status: 'completed' | 'capped' | 'aborted' | 'error';
  errorCode: number;
  rxSaturated: boolean;
  txLost: boolean;
}

export interface SegmentObservation {
  type: number;
  label: string;
  key: string;
  fields: Record<string, string | number>;
}

export function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function readDiscoveryTlvs(
  bytes: Uint8Array,
  offset: number,
  count: number,
): {
  entries: { type: number; value: Uint8Array }[];
  offset: number;
} {
  const entries: { type: number; value: Uint8Array }[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 2 > bytes.length) throw new Error('Truncated Discovery TLV header');
    const [type, length] = bytes.subarray(offset, offset + 2);
    const end = offset + 2 + length;
    if (end > bytes.length) throw new Error('Truncated Discovery TLV value');
    entries.push({ type, value: bytes.subarray(offset + 2, end) });
    offset = end;
  }
  return { entries, offset };
}

export function parseDiscoveryProgress(bytes: Uint8Array): DiscoveryProgress {
  if (bytes.length < 8) throw new Error('Invalid Discovery progress');
  const view = dataView(bytes);
  const extended = bytes.length >= 16;
  return {
    methodsDone: view.getUint16(2, true) | (extended ? view.getUint16(8, true) << 16 : 0),
    hosts: view.getUint16(6, true),
    probed: extended ? view.getUint16(12, true) : 0,
    total: extended ? view.getUint16(14, true) : 0,
  };
}

export function parseDiscoveryDone(bytes: Uint8Array): DiscoveryDone {
  if (bytes.length < 8) throw new Error('Invalid Discovery completion');
  const view = dataView(bytes);
  const extended = bytes.length >= 15;
  const statuses = ['completed', 'capped', 'aborted', 'error'] as const;
  return {
    status: statuses[bytes[1]] ?? 'error',
    methodsDone: view.getUint16(2, true) | (extended ? view.getUint16(9, true) << 16 : 0),
    hosts: view.getUint16(4, true),
    errorCode: view.getUint16(6, true),
    rxSaturated: Boolean(bytes[8] & 1),
    txLost: Boolean(bytes[8] & 2),
    probed: extended ? view.getUint16(11, true) : 0,
    total: extended ? view.getUint16(13, true) : 0,
  };
}

const IDENTITY_TEXT: Partial<Record<number, string>> = {
  1: 'Hostname',
  3: 'SSDP server',
  5: 'NetBIOS name',
  6: 'NetBIOS workgroup',
  7: 'Reverse DNS',
};
const DEVICE_TEXT: Partial<Record<number, readonly [string, string]>> = {
  9: ['PROFINET', 'Name'],
  10: ['PROFINET', 'Device type'],
  14: ['BACnet', 'Name'],
  15: ['BACnet', 'Vendor'],
  16: ['BACnet', 'Model'],
  17: ['BACnet', 'Firmware'],
  18: ['BACnet', 'Application version'],
  19: ['BACnet', 'Location'],
  22: ['EtherNet/IP', 'Name'],
  24: ['KNX', 'Name'],
  26: ['Camera vendor', 'Model'],
  27: ['Camera vendor', 'Serial'],
  28: ['Camera vendor', 'Firmware'],
  29: ['Camera vendor', 'Name'],
  31: ['Art-Net', 'Short name'],
  32: ['Art-Net', 'Long name'],
  33: ['Art-Net', 'Report'],
  35: ['ONVIF', 'Name'],
  36: ['ONVIF', 'Hardware'],
  37: ['ONVIF', 'Location'],
  38: ['ONVIF', 'Endpoint'],
  39: ['ONVIF', 'Address'],
};

function applyHostTlv(host: DiscoveryHost, type: number, value: Uint8Array): void {
  const identity = IDENTITY_TEXT[type];
  const device = DEVICE_TEXT[type];
  const view = dataView(value);
  const u16 = (offset: number) => view.getUint16(offset, true);
  const u32 = (offset: number) => view.getUint32(offset, true);
  const text = () => decodeText(value, 0, value.length);
  const fields = (name: string, data: Record<string, string | number>) => {
    host.devices[name] = { ...host.devices[name], ...data };
  };
  if (identity) {
    if (text()) host.identity[identity] = text();
  } else if (device) {
    if (text()) fields(device[0], { [device[1]]: text() });
  } else if (type === 2 || type === 4) {
    if (text()) host.services.push(text());
  } else if (type === 8 && value.length >= 3) {
    host.identity['Round-trip time'] = `${u16(0)} ms`;
    host.identity.TTL = String(value[2]);
  } else if (type === 11 && value.length >= 16) {
    if (value[5] & 2) fields('PROFINET', { 'Vendor ID': u16(0), 'Device ID': u16(2) });
    if (value[5] & 4) fields('PROFINET', { Role: value[4] });
    if (value[5] & 1)
      fields('PROFINET', {
        'IP flags': u16(6),
        Mask: bytesToIpv4(value, 8),
        Gateway: bytesToIpv4(value, 12),
      });
  } else if (type === 12 && value.length >= 2) {
    host.methods |= u16(0) << 16;
  } else if (type === 13 && value.length >= 15) {
    fields('BACnet', { Port: u16(10) });
    if (value[13] & 1) fields('BACnet', { Instance: u32(0) });
    if (value[13] & 2) fields('BACnet', { 'Vendor ID': u16(8) });
    if (value[13] & 4) fields('BACnet', { 'Protocol revision': value[12] });
    if (value[13] & 8) fields('BACnet', { Objects: u32(4) });
  } else if (type === 21 && value.length >= 22) {
    fields('EtherNet/IP', {
      'Vendor ID': u16(0),
      'Device type': u16(2),
      'Product code': u16(4),
      Revision: `${value[6]}.${value[7]}`,
      Status: u16(8),
      Serial: u32(10),
      IP: bytesToIpv4(value, 14),
      Port: u16(18),
    });
  } else if (type === 23 && value.length >= 42) {
    const address = u16(0);
    fields('KNX', {
      Address: `${address >> 12}.${(address >> 8) & 15}.${address & 255}`,
      Project: u16(2),
      Serial: formatMac(value.subarray(4, 10)).replace(/:/g, ''),
      Multicast: bytesToIpv4(value, 10),
      MAC: formatMac(value.subarray(14, 20)),
      Medium: value[20],
      'Programming mode': value[21] & 1 ? 'Yes' : 'No',
    });
  } else if (type === 25 && value.length >= 16) {
    const vendor = ['', 'Hikvision', 'Dahua', 'Ubiquiti'][value[0]];
    fields('Camera vendor', {
      ...(vendor ? { Vendor: vendor } : {}),
      'HTTP port': u16(2),
      'Other port': u16(4),
      IP: bytesToIpv4(value, 6),
      MAC: formatMac(value.subarray(10, 16)),
    });
  } else if (type === 30 && value.length >= 10) {
    fields('Art-Net', {
      'Bind index': value[0],
      Style: value[1],
      Ports: value[2],
      ESTA: u16(4),
      OEM: u16(6),
      Version: u16(8),
    });
  } else if (type === 34 && value.length >= 10) {
    const sources = ['Probe', 'Directed', 'Hello', 'Bye'].filter((_, i) => value[0] & (1 << i));
    fields('ONVIF', { 'Seen via': sources.join(', ') });
  } else {
    // Keep extension bytes available in saved JSON even when only the type is known.
    const name = HOST_DEVICE_TLVS[type];
    if (name) fields(name, {});
    host.unknown.push({ type, hex: formatMac(value).replace(/:/g, '') });
  }
}

const HOST_DEVICE_TLVS: Partial<Record<number, string>> = {
  13: 'BACnet',
  20: 'BACnet',
  21: 'EtherNet/IP',
  23: 'KNX',
  25: 'Camera vendor',
  30: 'Art-Net',
  34: 'ONVIF',
};

export function parseDiscoveryHosts(bytes: Uint8Array): DiscoveryHost[] {
  if (!bytes.length) throw new Error('Invalid Discovery host packet');
  const view = dataView(bytes);
  const hosts: DiscoveryHost[] = [];
  let offset = 1;
  while (offset < bytes.length) {
    if (bytes.length - offset < 13) throw new Error('Truncated Discovery host record');
    const mac = formatMac(bytes.subarray(offset + 4, offset + 10));
    const host: DiscoveryHost = {
      ip: bytesToIpv4(bytes, offset),
      mac: mac === '00:00:00:00:00:00' ? undefined : mac,
      methods: view.getUint16(offset + 10, true),
      identity: {},
      services: [],
      devices: {},
      unknown: [],
    };
    const tlvs = readDiscoveryTlvs(bytes, offset + 13, bytes[offset + 12]);
    for (const { type, value } of tlvs.entries) applyHostTlv(host, type, value);
    hosts.push(host);
    offset = tlvs.offset;
  }
  return hosts;
}
