import { bytesToIpv4, decodeText, formatIpv6, formatMac } from './bytes';
import type { FieldMap, FieldsResult, Ipv6Mode } from './types';

function formatSeconds(value: number): string {
  if (value < 60) return `${value} s`;
  if (value % 3600 === 0) return `${value / 3600} h`;
  return `${Math.floor(value / 60)} min`;
}

export function parseIpv4Packet(payload: Uint8Array): FieldsResult {
  if (payload.length < 14) throw new Error('Invalid IPv4 packet: missing Ethernet header');
  const ethType = (payload[12] << 8) | payload[13];
  const ethLength = ethType === 0x8100 ? 18 : 14;
  if (payload.length < ethLength + 20) throw new Error('Invalid IPv4 packet: missing IP header');
  const ipStart = ethLength;
  if (payload[ipStart] >>> 4 !== 4) throw new Error('Invalid IPv4 packet: unexpected IP version');
  const ipHeaderLength = (payload[ipStart] & 15) * 4;
  const udpStart = ipStart + ipHeaderLength;
  if (payload[ipStart + 9] !== 17 || payload.length < udpStart + 8)
    throw new Error('Invalid IPv4 packet: DHCP UDP payload missing');
  const dhcpStart = udpStart + 8;
  if (payload.length < dhcpStart + 240) throw new Error('Invalid DHCPv4 packet: header too short');
  const view = new DataView(
    payload.buffer,
    payload.byteOffset + dhcpStart,
    payload.length - dhcpStart,
  );
  if (view.getUint32(236, false) !== 0x63825363)
    throw new Error('Invalid DHCPv4 packet: missing magic cookie');
  const dhcpBytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const fields: FieldMap = {
    'Eth Src Addr': formatMac(payload.slice(6, 12)),
    'Source IP': bytesToIpv4(payload, ipStart + 12),
    'Your IP': bytesToIpv4(dhcpBytes, 16),
    'Next Server IP': bytesToIpv4(dhcpBytes, 20),
    'Relay IP': bytesToIpv4(dhcpBytes, 24),
  };
  const options = new Map<number, Uint8Array>();
  let offset = 240;
  while (offset < view.byteLength) {
    const option = view.getUint8(offset++);
    if (option === 0) continue;
    if (option === 255) break;
    if (offset >= view.byteLength) break;
    const length = view.getUint8(offset++);
    if (offset + length > view.byteLength) break;
    options.set(option, new Uint8Array(view.buffer, view.byteOffset + offset, length));
    offset += length;
  }
  const optionIp = (option: number): string => {
    const value = options.get(option);
    return value && value.length >= 4 ? bytesToIpv4(value) : '';
  };
  const ipList = (option: number): string => {
    const value = options.get(option);
    return value
      ? Array.from({ length: Math.floor(value.length / 4) }, (_, index) =>
          bytesToIpv4(value, index * 4),
        ).join(', ')
      : '';
  };
  const seconds = (option: number): string => {
    const value = options.get(option);
    return value && value.length >= 4
      ? formatSeconds(new DataView(value.buffer, value.byteOffset, 4).getUint32(0, false))
      : '';
  };
  fields['Subnet Mask'] = optionIp(1);
  fields.Gateway = ipList(3);
  fields['DNS Servers'] = ipList(6);
  fields['IP lease time'] = seconds(51);
  fields['Server ID'] = optionIp(54);
  fields['Renewal time'] = seconds(58);
  fields.Broadcast = optionIp(28);
  fields.Filename = decodeText(dhcpBytes, 108, 236);
  fields['Server name'] = decodeText(dhcpBytes, 44, 108);
  fields['Other options'] = Array.from(options.keys())
    .filter((option) => ![1, 3, 6, 28, 51, 54, 58].includes(option))
    .join(', ');
  return { status: 'OK', summary: `IP: ${fields['Your IP']}`, fields };
}

function ipv6PacketParts(payload: Uint8Array): {
  nextHeader: number;
  cursor: number;
  source: string;
  destination: string;
  sourceMac: string;
} {
  const ethLength = ((payload[12] << 8) | payload[13]) === 0x8100 ? 18 : 14;
  const ipStart = ethLength;
  if (payload.length < ipStart + 40 || payload[ipStart] >>> 4 !== 6)
    throw new Error('Invalid IPv6 packet');
  let nextHeader = payload[ipStart + 6];
  let cursor = ipStart + 40;
  while ([0, 43, 60].includes(nextHeader)) {
    const length = (payload[cursor + 1] + 1) * 8;
    nextHeader = payload[cursor];
    cursor += length;
  }
  return {
    nextHeader,
    cursor,
    source: formatIpv6(payload.slice(ipStart + 8, ipStart + 24)),
    destination: formatIpv6(payload.slice(ipStart + 24, ipStart + 40)),
    sourceMac: formatMac(payload.slice(6, 12)),
  };
}

function parseRaOptions(payload: Uint8Array, start: number, fields: FieldMap): void {
  for (let cursor = start; cursor + 2 <= payload.length;) {
    const type = payload[cursor];
    const length = payload[cursor + 1] * 8;
    if (!length || cursor + length + 2 > payload.length) break;
    const value = payload.slice(cursor + 2, cursor + length + 2);
    if (type === 1 && length >= 6) fields['Source LLA'] = formatMac(value.slice(0, 6));
    if (type === 3 && length >= 30) {
      fields['Prefix Info'] =
        `Length: ${value[0]} Flags: ${value[1] & 0x80 ? 'On-link' : ''}${value[1] & 0x40 ? `${value[1] & 0x80 ? ', ' : ''}Autonomous` : ''}`;
      fields['Valid lifetime'] = String(
        new DataView(value.buffer, value.byteOffset + 2, 4).getUint32(0, false),
      );
      fields['Preferred lifetime'] = String(
        new DataView(value.buffer, value.byteOffset + 6, 4).getUint32(0, false),
      );
      fields['Prefix addr'] = formatIpv6(value.slice(14, 30));
    }
    if (type === 5 && length >= 6)
      fields.MTU = String(new DataView(value.buffer, value.byteOffset + 2, 4).getUint32(0, false));
    if (type === 25 && length >= 22) {
      fields['RDNSS lifetime'] = String(
        new DataView(value.buffer, value.byteOffset + 2, 4).getUint32(0, false),
      );
      const addresses: string[] = [];
      for (let index = 6; index + 16 <= value.length; index += 16)
        addresses.push(formatIpv6(value.slice(index, index + 16)));
      fields['DNSv6 Server'] = addresses.join(', ');
    }
    cursor += length + 2;
  }
}

function parseDhcpv6Options(payload: Uint8Array, start: number, fields: FieldMap): void {
  for (let cursor = start; cursor + 4 <= payload.length;) {
    const type = (payload[cursor] << 8) | payload[cursor + 1];
    const length = (payload[cursor + 2] << 8) | payload[cursor + 3];
    if (cursor + length + 4 > payload.length) break;
    const value = payload.slice(cursor + 4, cursor + length + 4);
    if (type === 2)
      fields['Server DUID'] = Array.from(value)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(':')
        .toUpperCase();
    if (type === 5 && length >= 24) fields['IPv6 Address'] = formatIpv6(value.slice(0, 16));
    if (type === 23 && length >= 16)
      fields['DNSv6 Server'] = Array.from({ length: Math.floor(length / 16) }, (_, index) =>
        formatIpv6(value.slice(index * 16, index * 16 + 16)),
      ).join(', ');
    if (type === 3) parseDhcpv6Options(value, 12, fields);
    if (type === 4) parseDhcpv6Options(value, 4, fields);
    cursor += length + 4;
  }
}

export function parseIpv6Packet(
  payload: Uint8Array,
  mode: Ipv6Mode = 'slaac',
): FieldsResult & { protocol: 'DHCPv6' | 'SLAAC' } {
  const { nextHeader, cursor, source, destination, sourceMac } = ipv6PacketParts(payload);
  const fields: FieldMap = {
    'Eth Src Addr': sourceMac,
    'Source IP': source,
    'Destination IP': destination,
  };
  if (mode === 'dhcpv6' || nextHeader === 17) {
    if (nextHeader !== 17 || payload[cursor + 8] !== 7) throw new Error('Invalid DHCPv6 reply');
    parseDhcpv6Options(payload, cursor + 12, fields);
    return { status: 'OK', summary: 'DHCPv6 reply received', protocol: 'DHCPv6', fields };
  }
  if (nextHeader !== 58 || payload[cursor] !== 134) throw new Error('Invalid Router Advertisement');
  const flags = payload[cursor + 5];
  fields['Cur Hop Limit'] = String(payload[cursor + 4]);
  fields['Management flags'] =
    flags & 0xc0
      ? `${flags & 0x80 ? 'M' : ''}${flags & 0x40 ? `${flags & 0x80 ? ', ' : ''}O` : ''} flags set`
      : 'M/O flags not set';
  fields['Router lifetime'] = String(
    new DataView(payload.buffer, payload.byteOffset + cursor + 6, 2).getUint16(0, false),
  );
  parseRaOptions(payload, cursor + 16, fields);
  return {
    status: 'OK',
    summary: 'SLAAC Router Advertisement received',
    protocol: 'SLAAC',
    fields,
  };
}
