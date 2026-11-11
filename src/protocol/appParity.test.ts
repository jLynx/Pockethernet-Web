import assert from 'node:assert/strict';
import {
  measurementEthernetCommand,
  parseCdpLldpPacket,
  parseIpv6Packet,
  parsePoePacket,
  wifiBridgeCommand,
  ethernetStopCommand,
  parseDeviceInfo,
  PACKET,
  blinkerCommand,
} from '@/pockethernetProtocol';
import { ipv6Payload, lldpPayload, trafficPayload } from '@/app/measurementFixtures';

// APK protocol_pen.smali's manual config: timing word 10 at offset 10,
// and auto-negotiation only for an automatic speed or duplex selection.
for (const [speed, speedBits] of [
  ['10', 64],
  ['100', 128],
  ['1000', 256],
  ['auto', 448],
] as const) {
  for (const [duplex, duplexBits] of [
    ['half', 512],
    ['full', 1024],
    ['auto', 1536],
  ] as const) {
    for (const [mdi, mdiBits] of [
      ['mdi', 4],
      ['mdix', 8],
      ['auto', 12],
    ] as const) {
      for (const link of ['on', 'blink'] as const) {
        const expected = new Uint8Array(53);
        const view = new DataView(expected.buffer);
        view.setUint16(0, link === 'blink' ? 25 : 9, true);
        view.setUint32(
          4,
          65537 +
            speedBits +
            duplexBits +
            mdiBits +
            (speed === 'auto' || duplex === 'auto' ? 32 : 0),
          true,
        );
        view.setUint16(10, 10, true);
        const command = blinkerCommand(speed, duplex, mdi, link);
        assert.equal(command.type, PACKET.ETH_CONFIG);
        assert.deepEqual(command.payload, expected, `${speed}/${duplex}/${mdi}/${link}`);
      }
    }
  }
}

// APK measdata_pen.smali's no-power branch precedes every PoE mode, including stale flags.
for (const mode of [0, 1, 79, 80, 255]) {
  const payload = new Uint8Array(32);
  payload[2] = mode;
  new DataView(payload.buffer).setInt16(6, 480, true);
  const result = parsePoePacket(payload);
  assert.equal(result.status, 'not_OK');
  assert.equal(result.summary, 'No PoE');
  assert.equal(result.poeType, '');
}
// Nonzero raw values which round to zero are NOT the stock no-power branch.
for (const raw of [1, -1, 4, -4, 480]) {
  const payload = new Uint8Array(32);
  new DataView(payload.buffer).setInt16(4, raw, true);
  const result = parsePoePacket(payload);
  assert.match(result.summary, /Passive PoE/);
  assert.equal(result.status, 'OK');
}
assert.throws(() => parsePoePacket(new Uint8Array(31)), /Invalid PoE/);

// ADC unsigned conversion, polarity orientation, both-mode imbalance, and AT voltage threshold.
const activePoe = new Uint8Array(32);
const poeView = new DataView(activePoe.buffer);
activePoe.set([2, 4, 20]);
poeView.setInt16(4, 480, true);
poeView.setInt16(6, 400, true);
poeView.setUint16(16, 1000, true);
poeView.setUint16(18, 21000, true);
poeView.setUint16(20, 30000, true);
poeView.setUint16(22, 1000, true);
const at = parsePoePacket(activePoe);
assert.equal(at.poeType, 'AT');
assert.equal(at.status, 'not_OK'); // 40 V is below the APK's AT threshold of 42 V.
assert.equal(at.polarity, '1-2: - | 3-6: + | 4-5: + | 7-8: -');
assert.equal(at.unbalanced, true);
assert.match(at.summary, /^UB! /);
poeView.setUint16(18, 61000, true);
assert.equal(parsePoePacket(activePoe).adc[1], 61000);
activePoe.set([1, 1, 20]);
assert.equal(parsePoePacket(activePoe).status, 'OK'); // Same voltages classified AF/AT.

for (const [mac, expected] of [
  [[0, 17, 34, 51, 68, 255], '00:11:22:33:45:02'],
  [[0, 17, 34, 51, 255, 254], '00:11:22:34:00:01'],
  [[255, 255, 255, 255, 255, 255], '00:00:00:00:00:02'],
] as const) {
  const info = new Uint8Array(35);
  info.set(mac, 29);
  assert.equal(parseDeviceInfo(info).mac, expected);
}

// One combined APK network setup must preserve every selected feature's bits and static IP.
for (const mode of [null, 'slaac', 'dhcpv6', 'both'] as const) {
  const command = measurementEthernetCommand({
    discovery: true,
    collectVlans: true,
    outgoingVlanId: 4094,
    customMac: '02:11:22:33:44:55',
    ipv4: true,
    ipv4Settings: { mode: 'dhcp' },
    ipv6: mode,
  });
  const view = new DataView(command.payload.buffer);
  assert.equal(command.type, PACKET.ETH_CONFIG);
  assert.equal(command.payload.length, 53);
  assert.equal(view.getUint16(0, true), 361);
  assert.equal(view.getUint32(4, true), 1773);
  assert.equal(view.getUint16(8, true), 4094);
  assert.equal(
    view.getUint16(2, true),
    mode === null ? 3 : mode === 'slaac' ? 27 : mode === 'dhcpv6' ? 43 : 59,
  );
  assert.deepEqual([...command.payload.slice(14, 20)], [2, 17, 34, 51, 68, 85]);
}
const staticCommand = measurementEthernetCommand({
  discovery: false,
  collectVlans: false,
  ipv4: true,
  ipv6: null,
  ipv4Settings: {
    mode: 'static',
    ip: '192.0.2.3',
    netmask: '255.255.255.0',
    gateway: '192.0.2.1',
    dns: '192.0.2.53',
  },
});
assert.equal(new DataView(staticCommand.payload.buffer).getUint16(2, true), 1);
assert.deepEqual(
  [...staticCommand.payload.slice(20, 36)],
  [192, 0, 2, 3, 255, 255, 255, 0, 192, 0, 2, 1, 192, 0, 2, 53],
);
assert.deepEqual(ethernetStopCommand(), { type: PACKET.ETH_STOP, payload: new Uint8Array() });
assert.equal(wifiBridgeCommand(true).payload[39], 4); // APK's WPA/WPA2 PSK enum.

// CDP TLV 10 is a two-byte network-order value immediately after the TLV header.
const cdp = Uint8Array.of(
  ...trafficPayload.slice(0, 12),
  0,
  64,
  0xaa,
  0xaa,
  3,
  0,
  0,
  12,
  0x20,
  0,
  2,
  180,
  0,
  0,
  0,
  10,
  0,
  6,
  0x01,
  0x23,
  0,
  11,
  0,
  5,
  1,
  0,
  17,
  0,
  8,
  0,
  0,
  5,
  0xdc,
);
const discovery = parseCdpLldpPacket(cdp);
assert.equal(discovery.fields['Native VLAN'], '291');
assert.equal(discovery.fields.Duplex, 'Full');
assert.equal(discovery.fields.MTU, '1500');
const snapLldp = Uint8Array.of(
  ...lldpPayload.slice(0, 12),
  0,
  64,
  0xaa,
  0xaa,
  3,
  0,
  0,
  0,
  0x88,
  0xcc,
  ...lldpPayload.slice(14),
);
assert.equal(parseCdpLldpPacket(snapLldp).fields['System name'], 'sw1');

// RA option length includes its 2-byte header. Consecutive prefix/MTU/DNS options must all parse.
const prefix = [
  3,
  4,
  64,
  0xc0,
  0,
  0,
  0x0e,
  0x10,
  0,
  0,
  7,
  8,
  0,
  0,
  0,
  0,
  0x20,
  1,
  0x0d,
  0xb8,
  0,
  1,
  ...Array<number>(10).fill(0),
];
assert.equal(prefix.length, 32);
const mtu = [5, 1, 0, 0, 0, 0, 5, 0xdc];
const rdnss = [25, 3, 0, 0, 0, 0, 0, 120, 0x20, 1, 0x0d, 0xb8, ...Array<number>(11).fill(0), 53];
const source = [1, 1, 2, 3, 4, 5, 6, 7];
const header = [134, 0, 0, 0, 64, 0xc0, 0, 120, ...Array<number>(8).fill(0)];
const ra = ipv6Payload(58, [...header, ...prefix, ...mtu, ...rdnss, ...source]);
const ipv6 = parseIpv6Packet(ra);
assert.equal(ipv6.fields['Prefix addr'], '2001:DB8:1::');
assert.equal(ipv6.fields['Valid lifetime'], '3600');
assert.equal(ipv6.fields['Preferred lifetime'], '1800');
assert.equal(ipv6.fields.MTU, '1500');
assert.equal(ipv6.fields['DNSv6 Server'], '2001:DB8::35');
assert.equal(ipv6.fields['Source LLA'], '02:03:04:05:06:07');
assert.throws(() => parseIpv6Packet(ra.slice(0, -1)), /option length/);
assert.throws(() => parseIpv6Packet(ipv6Payload(58, [134])), /Invalid Router Advertisement/);
assert.throws(() => parseIpv6Packet(ipv6Payload(0, [58, 1])), /extension header/);
console.log('APK parser/command parity regression tests passed.');
