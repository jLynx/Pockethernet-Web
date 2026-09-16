import { PACKET } from './constants';
import type {
  BerFrameSize,
  BerPayloadMode,
  BerSpeed,
  BlinkerDuplex,
  BlinkerLink,
  BlinkerMdi,
  BlinkerSpeed,
  Ipv4Mode,
  Ipv4Settings,
  Ipv6Mode,
  Packet,
  TonerPair,
  TonerShield,
  TonerTone,
  TonerVolume,
} from './types';

function applyCustomMac(payload: Uint8Array, value: string): void {
  if (!value.trim()) return;
  const bytes = value
    .trim()
    .split(/[:-]/)
    .map((part) => Number.parseInt(part, 16));
  if (
    bytes.length !== 6 ||
    bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
  ) {
    throw new Error(`Invalid custom MAC address: ${value}`);
  }
  payload.set(bytes, 14);
}

function ethernetCommand(flags: number, phyFlags: number, customMac = ''): Packet {
  const payload = new Uint8Array(53);
  const view = new DataView(payload.buffer);
  view.setUint16(0, flags, true);
  view.setUint32(4, phyFlags, true);
  applyCustomMac(payload, customMac);
  return { type: PACKET.ETH_CONFIG, payload };
}

function ipv4ToUint32(value = ''): number {
  const parts = value.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    throw new Error(`Invalid IPv4 address: ${value}`);
  }
  return parts[0] | (parts[1] << 8) | (parts[2] << 16) | (parts[3] << 24);
}

export function deviceInfoCommand(): Packet {
  return { type: PACKET.DEVICE_INFO, payload: new Uint8Array() };
}

export function wiremapCommand(): Packet {
  const payload = new Uint8Array(8);
  const view = new DataView(payload.buffer);
  view.setInt32(0, 36363, true);
  view.setInt32(4, 64, true);
  return { type: PACKET.WIREMAP, payload };
}

export function diagnosticEthernetCommand(customMac = ''): Packet {
  return ethernetCommand(9, 0, customMac);
}

export function linkCommand(customMac = ''): Packet {
  return ethernetCommand(129, 67565, customMac);
}

export function cdpLldpCommand(customMac = ''): Packet {
  return ethernetCommand(105, 1773, customMac);
}

export function vlanEthernetCommand(outgoingVlanId = 0, customMac = ''): Packet {
  if (!Number.isInteger(outgoingVlanId) || outgoingVlanId < 0 || outgoingVlanId > 4094) {
    throw new Error('VLAN ID must be between 1 and 4094');
  }
  const command = ethernetCommand(265, 1901, customMac);
  new DataView(command.payload.buffer).setUint16(8, outgoingVlanId, true);
  return command;
}

export function trafficEthernetCommand(customMac = ''): Packet {
  const command = ethernetCommand(9, 1773, customMac);
  new DataView(command.payload.buffer).setUint16(2, 3, true);
  return command;
}

export function trafficFilterCommand(): Packet {
  const payload = new Uint8Array(32);
  payload[5] = 1;
  return { type: PACKET.ETH_FILTER_ADD, payload };
}

export function blinkerCommand(
  speed: BlinkerSpeed = 'auto',
  duplex: BlinkerDuplex = 'auto',
  mdi: BlinkerMdi = 'auto',
  link: BlinkerLink = 'off',
): Packet {
  if (link === 'off') return { type: PACKET.ETH_STOP, payload: new Uint8Array() };
  const speedFlags = { '10': 64, '100': 128, '1000': 256, auto: 64 | 128 | 256 }[speed];
  const duplexFlags = { half: 512, full: 1024, auto: 512 | 1024 }[duplex];
  const mdiFlags = { mdi: 4, mdix: 8, auto: 4 | 8 }[mdi];
  const payload = new Uint8Array(53);
  const view = new DataView(payload.buffer);
  view.setUint16(0, 9 + (link === 'blink' ? 16 : 0), true);
  view.setUint32(4, 1 | speedFlags | duplexFlags | mdiFlags | 32 | 65536, true);
  return { type: PACKET.ETH_CONFIG, payload };
}

export function tonerCommand(
  pair: TonerPair = 'all',
  shield: TonerShield = 'off',
  tone: TonerTone = '1',
  volume: TonerVolume = 'high',
): Packet {
  const pairMask = { '2': 1, '3': 2, '1': 4, '4': 8, all: 15 }[pair];
  const shieldFlag = shield === 'on' ? 16 : 0;
  const volumeValue = { low: 1, high: 2 }[volume];
  const toneValues = {
    '1': [600, 1200, 67],
    '2': [400, 700, 150],
    '3': [650, 0, 400],
    '4': [800, 0, 0],
  }[tone];
  const payload = new Uint8Array(20);
  const view = new DataView(payload.buffer);
  view.setInt32(0, pairMask + shieldFlag, true);
  view.setInt32(4, volumeValue, true);
  toneValues.forEach((value, index) => view.setInt32(8 + index * 4, value, true));
  return { type: PACKET.ANA_TONER, payload };
}

export function tonerStopCommand(): Packet {
  return { type: PACKET.ANA_TONER, payload: new Uint8Array(4) };
}

export function wifiBridgeEthernetCommand(): Packet {
  return ethernetCommand(11, 1645);
}

export function wifiBridgeCommand(
  enabled: boolean,
  ssid = 'Pockethernet',
  password = 'Pockethernet',
): Packet {
  const payload = new Uint8Array(144);
  const ssidBytes = new TextEncoder().encode(enabled ? ssid : '');
  const passwordBytes = new TextEncoder().encode(enabled ? password : '');
  if (ssidBytes.length > 32 || passwordBytes.length > 63)
    throw new Error('WiFi name or password is too long');
  const view = new DataView(payload.buffer);
  view.setUint16(0, enabled ? 3 : 0, true);
  payload.set(ssidBytes, 4);
  payload[36] = ssidBytes.length;
  payload[37] = passwordBytes.length;
  payload[38] = 1;
  if (passwordBytes.length) payload[39] = 3;
  payload.set(passwordBytes, 40);
  payload[103] = 1;
  return { type: PACKET.WIFI_CONFIG, payload };
}

export function ipv4EthernetCommand(
  mode: Ipv4Mode = 'dhcp',
  settings: Ipv4Settings = {},
  customMac = '',
): Packet {
  const command = ethernetCommand(9, 1773, customMac);
  const view = new DataView(command.payload.buffer);
  const staticMode = mode === 'static';
  view.setUint16(2, staticMode ? 1 : 3, true);
  if (staticMode) {
    view.setUint32(20, ipv4ToUint32(settings.ip), true);
    view.setUint32(24, ipv4ToUint32(settings.netmask), true);
    view.setUint32(28, ipv4ToUint32(settings.gateway), true);
    view.setUint32(32, ipv4ToUint32(settings.dns), true);
  }
  return command;
}

export function externalIpEthernetCommand(customMac = ''): Packet {
  return ipv4EthernetCommand('dhcp', {}, customMac);
}

export function ipv6EthernetCommand(mode: Ipv6Mode = 'slaac', customMac = ''): Packet {
  const command = ethernetCommand(9, 1773, customMac);
  new DataView(command.payload.buffer).setUint16(
    2,
    mode === 'dhcpv6' ? 41 : mode === 'both' ? 57 : 25,
    true,
  );
  return command;
}

export function pingCommand(target: string): Packet {
  const targetBytes = new TextEncoder().encode(target.trim());
  if (!targetBytes.length || targetBytes.length > 127)
    throw new Error('Ping target must be between 1 and 127 characters');
  const payload = new Uint8Array(targetBytes.length + 13);
  const view = new DataView(payload.buffer);
  view.setUint16(0, 100, true);
  view.setUint16(2, 500, true);
  view.setUint16(4, 64, true);
  view.setUint32(6, 2000, true);
  payload.set([3, 0, 255, 0], 8);
  payload.set(targetBytes, 12);
  return { type: PACKET.PING, payload };
}

export function externalIpCommand(): Packet {
  const url =
    'http://pro.ip-api.com/json?key=2NT4TLwAVDyCwHk&fields=country,region,city,isp,as,status,message,query';
  const payload = new Uint8Array(url.length + 37);
  payload.set(new TextEncoder().encode('PE'), 3);
  payload.set(new TextEncoder().encode(url), 36);
  new DataView(payload.buffer).setUint16(0, 10000, true);
  return { type: PACKET.HTTP_RESPONSE, payload };
}

export function berEthernetCommand(speed: BerSpeed = 1000, customMac = ''): Packet {
  const speedFlag = { 10: 64, 100: 128, 1000: 256 }[speed];
  const command = ethernetCommand(
    9,
    1 + 2 + 16 + 32 + 512 + 1024 + 16384 + 65536 + speedFlag,
    customMac,
  );
  new DataView(command.payload.buffer).setUint16(10, 10, true);
  return command;
}

export function berCommand(
  frameSize: BerFrameSize = 64,
  payloadMode: BerPayloadMode = 'random',
  packetCount = 10000,
): Packet {
  if (!Number.isInteger(packetCount) || packetCount < 1)
    throw new Error(`Invalid BER packet count: ${packetCount}`);
  const payload = new Uint8Array(9);
  const view = new DataView(payload.buffer);
  view.setUint32(0, packetCount, true);
  view.setUint16(4, frameSize, true);
  view.setUint16(6, 12, true);
  payload[8] = payloadMode === 'random' ? 1 : 4;
  return { type: PACKET.BER, payload };
}

export function poeCommand(): Packet {
  return { type: PACKET.POE, payload: new Uint8Array() };
}

function tdrPacket(type: number, values: number[]): Packet {
  const payload = new Uint8Array(16);
  const view = new DataView(payload.buffer);
  values.forEach((value, index) => view.setInt16(index * 2, value, true));
  return { type, payload };
}

export function tdrCommand(): Packet {
  return tdrPacket(PACKET.TDR_SAME, [3, 3, 0, 0, 189, 64, 8, 3]);
}

export function tdrCrosstalkCommand(): Packet {
  return tdrPacket(PACKET.TDR_CROSS, [3, 4, 0, 0, 189, 64, 8, 2]);
}
