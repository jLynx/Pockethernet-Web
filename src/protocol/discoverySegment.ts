import { bytesToIpv4, decodeText, formatMac } from './bytes';
import { dataView, readDiscoveryTlvs, type SegmentObservation } from './networkDiscovery';

const ETHER_TYPES: Partial<Record<number, string>> = {
  0x0800: 'IPv4',
  0x0806: 'ARP',
  0x8100: '802.1Q',
  0x86dd: 'IPv6',
  0x8809: 'Slow protocols',
  0x888e: '802.1X',
  0x88a4: 'EtherCAT',
  0x88a8: '802.1ad',
  0x88b8: 'GOOSE',
  0x88ba: 'Sampled Values',
  0x88cc: 'LLDP',
  0x88f7: 'PTP',
  0x8892: 'PROFINET',
  0x22f0: 'AVTP',
  0x9000: 'Loopback',
};

function etherType(value: number): string {
  const code = `0x${value.toString(16).toUpperCase().padStart(4, '0')}`;
  return ETHER_TYPES[value] ? `${ETHER_TYPES[value]} (${code})` : code;
}

const SEGMENT_TYPES: Partial<Record<number, readonly [string, number]>> = {
  1: ['VLAN', 2],
  2: ['Traffic totals', 27],
  3: ['Observed MAC', 30],
  4: ['IPv4 subnet', 15],
  5: ['STP', 29],
  6: ['EtherType', 6],
  7: ['IGMP querier', 15],
  8: ['PTP clock', 52],
  9: ['802.1X', 18],
  10: ['First traffic', 12],
  11: ['BACnet BBMD', 20],
  12: ['BACnet router', 38],
  15: ['Multicast group', 24],
  16: ['BACnet traffic', 15],
  17: ['BACnet device', 45],
  18: ['BACnet Who-Is', 32],
  19: ['Ubiquiti discovery', 20],
  20: ['Art-Net traffic', 17],
  21: ['Art-Net node', 38],
  22: ['Art-Net poller', 24],
  23: ['Art-Net universe', 31],
  24: ['sACN traffic', 9],
  25: ['sACN source', 110],
  26: ['sACN universe', 28],
  27: ['GOOSE traffic', 21],
  28: ['GOOSE publisher', 177],
  29: ['ATDECC traffic', 8],
  32: ['ATDECC entity', 73],
  33: ['SAP traffic', 7],
  34: ['SAP session', 164],
};

function decodeObservation(type: number, value: Uint8Array): SegmentObservation {
  const known = SEGMENT_TYPES[type];
  const label = known?.[0] ?? `Unknown segment record ${type}`;
  const observation = (key: string | number, fields: SegmentObservation['fields']) => ({
    type,
    label,
    key: `${type}:${key}`,
    fields,
  });
  const raw = () => formatMac(value).replace(/:/g, '');
  if (!known || value.length < known[1]) return observation(raw(), { Data: raw() });
  const view = dataView(value);
  const u16 = (offset: number) => view.getUint16(offset, true);
  const u32 = (offset: number) => view.getUint32(offset, true);
  const mac = (offset: number) => formatMac(value.subarray(offset, offset + 6));
  const ip = (offset: number) => bytesToIpv4(value, offset);
  const hex = (offset: number, length: number) =>
    formatMac(value.subarray(offset, offset + length));
  const ipv4Device = () => ({ IP: ip(0), MAC: mac(4), VLAN: u16(10) });
  switch (type) {
    case 1: {
      const tag = u16(0);
      return observation(tag, { VLAN: tag & 4095, Priority: tag >> 13, DEI: (tag >> 12) & 1 });
    }
    case 2:
      return observation('total', {
        'Unique MACs': u16(0),
        Frames: u32(2),
        'Unicast to tester': u32(6),
        'Other unicast': u32(10),
        Broadcast: u32(14),
        Multicast: u32(18),
        Dropped: u32(23),
        'Limit flags': value[22],
      });
    case 3: {
      const vlans = [6, 8, 10, 12].map(u16).filter((vlan) => vlan !== 0xffff);
      return observation(mac(0), {
        MAC: mac(0),
        VLANs: vlans.join(', '),
        'Unicast to tester': u32(14),
        'Other unicast': u32(18),
        Broadcast: u32(22),
        Multicast: u32(26),
        ...(value.length >= 34 && u32(30) !== 0 ? { IP: ip(30) } : {}),
      });
    }
    case 4: {
      const network = `${ip(0)}/${value[4]}`;
      return observation(`${network}:${u16(7)}`, {
        Network: network,
        Hosts: u16(5),
        VLAN: u16(7),
        'Sample MAC': mac(9),
      });
    }
    case 5:
      return observation(mac(11), {
        Protocol: ({ 0: 'STP', 2: 'RSTP', 3: 'MSTP' } as Record<number, string>)[value[0]] ?? 'STP',
        'Root bridge': mac(3),
        'Root priority': view.getUint16(1),
        'Sender bridge': mac(11),
        'Sender priority': view.getUint16(9),
        'Root path cost': u32(17),
        'Port ID': u16(21),
        'Port role': ['', 'Alternate', 'Root', 'Designated'][(value[26] >> 2) & 3],
        'Hello (s)': value[23],
        'Max age (s)': value[24],
        'Forward delay (s)': value[25],
        'Topology change': value[26] & 1 ? 'Yes' : 'No',
        'Topology change acknowledged': value[26] & 2 ? 'Yes' : 'No',
        Frames: u16(27),
      });
    case 6:
      return observation(u16(0), { Protocol: etherType(u16(0)), Frames: u32(2) });
    case 7:
      return observation(ip(0), {
        IP: ip(0),
        Version: value[4],
        'Interval (s)': u16(5),
        'Advertised interval (s)': u16(7),
        Queries: u16(9),
        'Last seen (ms ago)': u32(11),
      });
    case 8: {
      const idLength = value[0] === 1 ? 6 : 8;
      const sender = hex(4, idLength);
      const announces = u16(44);
      return observation(`${sender}:${value[2]}:${u16(12)}:${u16(42)}`, {
        Version: value[0],
        Transport: value[1] === 1 ? 'Ethernet' : 'UDP',
        Profile: value[3] & 8 ? 'gPTP' : 'PTP',
        Domain: value[2],
        'Sender clock': sender,
        'Sender port': u16(12),
        MAC: mac(32),
        ...(u32(38) ? { IP: ip(38) } : {}),
        VLAN: u16(42),
        Announces: announces,
        Syncs: u16(46),
        'Last seen (ms ago)': u32(48),
        ...(value[3] & 1
          ? {
              'Grandmaster clock': hex(14, idLength),
              'Clock class': value[24],
              'Steps removed': u16(27),
            }
          : {}),
        'Two-step': value[3] & 4 ? 'Yes' : 'No',
      });
    }
    case 9:
      return observation(mac(0), {
        Authenticator: mac(0),
        Requests: u16(6),
        Starts: u16(8),
        ...(u32(10) === 0xffffffff ? {} : { 'First request delay (ms)': u32(10) }),
        'Last seen (ms ago)': u32(14),
      });
    case 10:
      return observation('first', {
        'Delay (ms)': u32(0),
        Source: mac(4),
        Protocol: etherType(u16(10)),
      });
    case 11:
      return observation(`${ip(0)}:${u16(4)}`, {
        IP: ip(0),
        Port: u16(4),
        MAC: mac(6),
        VLAN: u16(12),
        Forwards: u16(14),
        'Last seen (ms ago)': u32(16),
      });
    case 12:
      return observation(`${ip(0)}:${u16(4)}:${mac(6)}`, {
        IP: ip(0),
        Port: u16(4),
        MAC: mac(6),
        VLAN: u16(12),
        Networks: Array.from({ length: Math.min(value[15], 8) }, (_, index) =>
          u16(16 + index * 2),
        ).join(', '),
        Advertisements: u16(32),
        'Last seen (ms ago)': u32(34),
      });
    case 15:
      return observation(`${mac(0)}:${mac(10)}:${u16(6)}`, {
        MAC: mac(0),
        VLAN: u16(6),
        Protocol: etherType(u16(8)),
        Destination: mac(10),
        ...(u32(16) ? { Group: ip(16) } : {}),
        Frames: u32(20),
      });
    case 16:
      return observation('total', {
        'IP frames': u32(0),
        'Ethernet frames': u16(4),
        Ports: u16(8),
      });
    case 17:
      return observation(u32(0), {
        Instance: u32(0),
        'Vendor ID': u16(4),
        'Max APDU': u16(6),
        Segmentation: ['Both', 'Transmit', 'Receive', 'None'][value[8]] ?? value[8],
        ...(u32(31) ? { 'Via IP': ip(31), 'Via port': u16(35) } : {}),
        Announcements: u16(39),
        'Last seen (ms ago)': u32(41),
      });
    case 18:
      return observation(`${ip(0)}:${mac(4)}:${u16(10)}`, {
        Queries: u16(24),
        'Unranged queries': u16(26),
        'Last seen (ms ago)': u32(28),
      });
    case 19:
      return observation(mac(4), {
        ...ipv4Device(),
        Version: value[13],
        Frames: u16(14),
        'Last seen (ms ago)': u32(16),
      });
    case 20:
      return observation('total', { Frames: u32(0), Polls: u16(4), Replies: u16(6), DMX: u32(8) });
    case 21:
      return observation(`${mac(4)}:${ip(0)}:${value[12]}`, {
        ...ipv4Device(),
        'Bind index': value[12],
        Style: value[13],
        Ports: value[14],
        Frames: u16(32),
        'Last seen (ms ago)': u32(34),
      });
    case 22:
      return observation(`${mac(4)}:${u16(10)}`, {
        ...ipv4Device(),
        'Protocol version': value[13],
        Polls: u16(14),
        'Poll interval (ms)': u32(16),
        'Last seen (ms ago)': u32(20),
      });
    case 23:
      return observation(`${u16(0)}:${ip(2)}:${u16(12)}`, {
        Universe: u16(0),
        IP: ip(2),
        MAC: mac(6),
        VLAN: u16(12),
        Slots: u16(15),
        Frames: u32(17),
        'Sequence gaps': u16(21),
        'Span (ms)': u32(23),
        'Last seen (ms ago)': u32(27),
      });
    case 24:
      return observation('total', { Frames: u32(0), Discovery: u16(4), Sync: u16(6) });
    case 25: {
      const cid = hex(0, 16);
      return observation(cid, {
        CID: cid,
        Name: decodeText(value, 16, 80),
        IP: ip(80),
        MAC: mac(84),
        VLAN: u16(90),
        Priority: value[93],
        'Data packets': u32(98),
        'Discovery packets': u16(102),
        'Last seen (ms ago)': u32(106),
      });
    }
    case 26:
      return observation(u16(0), {
        Universe: u16(0),
        Sources: value[3],
        Priority: value[4],
        Slots: u16(6),
        Frames: u32(8),
        'Span (ms)': u32(12),
        'Last seen (ms ago)': u32(16),
      });
    case 27:
      return observation('total', {
        Frames: u32(0),
        Invalid: u32(4),
        'Sampled Values frames': u32(8),
      });
    case 28:
      return observation(`${mac(0)}:${u16(14)}`, {
        MAC: mac(0),
        Destination: mac(6),
        VLAN: u16(12),
        'Application ID': u16(14),
        'Time allowed to live (ms)': u32(145),
        State: u32(149),
        Sequence: u32(153),
        'Configuration revision': u32(157),
        Entries: u16(161),
        Frames: u32(165),
      });
    case 29:
      return observation('total', { 'Discovery frames': u32(0), Discovers: u16(4) });
    case 32:
      return observation(hex(0, 8), {
        'Entity ID': hex(0, 8),
        'Model ID': hex(8, 8),
        MAC: mac(59),
        Capabilities: u32(16),
        'Talker sources': u16(20),
        'Listener sinks': u16(24),
      });
    case 33:
      return observation('total', { Announcements: u16(0), Deletions: u16(2), Unread: u16(4) });
    case 34:
      return observation(`${ip(0)}:${u16(4)}`, {
        'Origin IP': ip(0),
        Hash: u16(4),
        'Connection IP': ip(127),
        MAC: mac(150),
        VLAN: u16(156),
        'Last seen (ms ago)': u32(160),
      });
    default:
      return observation(raw(), { Data: raw() });
  }
}

export function parseDiscoverySegment(bytes: Uint8Array): {
  listenMs: number;
  observations: SegmentObservation[];
} {
  if (bytes.length < 8 || bytes[1] !== 1) throw new Error('Invalid Discovery segment');
  const view = dataView(bytes);
  const { entries } = readDiscoveryTlvs(bytes, 8, view.getUint16(6, true));
  return {
    listenMs: view.getUint32(2, true),
    observations: entries.map(({ type, value }) => decodeObservation(type, value)),
  };
}
