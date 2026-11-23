import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dhcpPayload } from '@/app/measurementFixtures';
import { parseBatteryStatus, parseExternalIpPacket } from './basicParsers';
import { externalIpCommand, measurementEthernetCommand } from './commands';
import { linkEeeText, linkSnrText, parseLinkPacket, readNegotiatedLinkSpeed } from './linkParsers';
import { parseClasslessRoutes, parseIpv4Packet } from './networkParsers';
import {
  combineTdrCaptures,
  decompressTdr,
  repairTdrSaturation,
  tdrCapturesAgree,
} from './tdrParser';
import type { TdrResult } from './types';

void test('battery percentage stays independent of charging state and an empty F110 cache', () => {
  assert.equal(parseBatteryStatus(new Uint8Array(4)), null);
  assert.deepEqual(parseBatteryStatus(Uint8Array.of(0xe8, 14, 81, 0b1000011)), {
    percent: 81,
    charging: true,
  });
  assert.deepEqual(parseBatteryStatus(Uint8Array.of(0xe8, 14, 100, 4)), {
    percent: 100,
    charging: false,
  });
  assert.deepEqual(parseBatteryStatus(Uint8Array.of(0xe8, 14, 255, 5)), {
    percent: null,
    charging: false,
  });
  assert.throws(() => parseBatteryStatus(Uint8Array.of(1, 2, 3)), /Invalid battery/);
});

void test('receive quality tracks the negotiated speed and preserves short link replies', () => {
  const payload = new Uint8Array(30);
  const view = new DataView(payload.buffer);
  view.setUint16(10, 64 | (5 << 7), true);
  view.setUint16(14, 6, true);
  [0, 4, 100, 256].forEach((mse, index) => view.setUint16(16 + index * 2, mse, true));
  const gigabit = parseLinkPacket(payload);
  assert.ok(gigabit.linkUp);
  assert.equal(linkEeeText(gigabit.eeePartnerMbps), '100 / 1000 Mbit/s');
  assert.deepEqual(gigabit.mse?.map(linkSnrText), ['> 30 dB', '24 dB', '10 dB', '6 dB']);
  view.setUint16(10, 64 | (3 << 7), true);
  const fastEthernet = parseLinkPacket(payload);
  assert.ok(fastEthernet.linkUp);
  assert.equal(fastEthernet.speed, 100);
  assert.deepEqual(fastEthernet.mse, [0]);
  assert.equal(readNegotiatedLinkSpeed(payload), 100);
  view.setUint16(10, 64 | (1 << 7), true);
  const legacy = parseLinkPacket(payload.slice(0, 14));
  assert.ok(legacy.linkUp);
  assert.equal(legacy.speed, 10);
  assert.equal(legacy.mse, undefined);
  assert.equal(legacy.eeePartnerMbps, undefined);
  view.setUint16(10, 0, true);
  assert.equal(readNegotiatedLinkSpeed(payload), 0);
});

void test('DHCP vendor class is encoded as option 60 and option 121 is decoded on v32', () => {
  const clientSettings = {
    discovery: false,
    collectVlans: false,
    ipv4: true,
    ipv4Settings: { mode: 'dhcp' as const },
    ipv6: null,
  };
  assert.equal(measurementEthernetCommand(clientSettings).payload.length, 53);
  const payload = measurementEthernetCommand({ ...clientSettings, dhcpVendorClass: 'PE' }).payload;
  assert.deepEqual([...payload.slice(52)], [4, 60, 2, 80, 69]);
  assert.throws(
    () =>
      measurementEthernetCommand({
        ...clientSettings,
        dhcpVendorClass: 'é'.repeat(33),
      }),
    /64 UTF-8 bytes/,
  );
  const captive = new TextEncoder().encode('https://portal.example/');
  const dhcp = dhcpPayload().slice(0, -1);
  const routes = [0, 192, 0, 2, 1, 25, 198, 51, 100, 255, 192, 0, 2, 3];
  const reply = Uint8Array.of(
    ...dhcp,
    60,
    2,
    80,
    69,
    114,
    captive.length,
    ...captive,
    121,
    routes.length,
    ...routes,
    255,
  );
  const parsed = parseIpv4Packet(reply);
  assert.equal(parsed.fields['Vendor class'], 'PE');
  assert.equal(parsed.fields['Captive portal URL'], 'https://portal.example/');
  assert.deepEqual(parsed.classlessRoutes, [
    { destination: '0.0.0.0', prefix: 0, router: '192.0.2.1' },
    { destination: '198.51.100.128', prefix: 25, router: '192.0.2.3' },
  ]);
  const legacy = parseIpv4Packet(reply, { classlessRoutes: false });
  assert.equal(legacy.classlessRoutes, undefined);
  assert.match(legacy.fields['Other options'], /121/);
  assert.equal(parseClasslessRoutes(Uint8Array.of(33, 0)), null);
});

void test('external IP detects redirects and intercepted HTML while preserving provider failures', () => {
  const parse = (text: string, checkPortal = true) =>
    parseExternalIpPacket(new TextEncoder().encode(text), checkPortal);
  assert.equal(
    parse('HTTP/1.1 302 Found\r\nLocation: https://portal.example/\r\n\r\n').fields[
      'Redirect location'
    ],
    'https://portal.example/',
  );
  assert.equal(
    parse('HTTP/1.0 200 OK\r\n\r\n<title>Login</title>').summary,
    'Possible captive portal',
  );
  assert.equal(parse('HTTP/1.1 503 Error\r\n\r\nDown').summary, 'External IP lookup failed');
  assert.equal(
    parse('HTTP/1.1 200 OK\r\n\r\n{"status":"fail","message":"quota exceeded"}').summary,
    'quota exceeded',
  );
  assert.equal(
    parse('{"status":"success","query":"198.51.100.7"}', false).fields.IP,
    '198.51.100.7',
  );
  assert.notDeepEqual(externalIpCommand(true).payload, externalIpCommand(false).payload);
});

void test('TDR uses the firmware sign bits, repairs old saturation and picks an agreeing capture', () => {
  const word = 0x8000 | 1 | 16 | (2 << 5) | (3 << 10) | (1 << 14);
  const bytes = Uint8Array.of(word & 255, word >> 8);
  assert.deepEqual(decompressTdr(bytes, 22), [-1, -2, 3]);
  assert.deepEqual(decompressTdr(bytes, 23), [-1, 2, -3]);
  assert.deepEqual(repairTdrSaturation([-80, 0, 0, -70, 0, 4]), [-80, -256, -256, -70, 0, 4]);
  const sample = (distance: number): TdrResult => ({
    status: 'OK',
    summary: String(distance),
    nvp: 71,
    pairs: Array.from({ length: 4 }, () => ({ distance, status: 'Open', samples: [distance] })),
  });
  const outlier = sample(25);
  const near = sample(12);
  assert.equal(tdrCapturesAgree(outlier, near), false);
  assert.equal(tdrCapturesAgree(near, sample(12.2)), true);
  const consensus = combineTdrCaptures(outlier, [near, sample(12.2)]);
  assert.deepEqual(
    consensus.pairs.map((pair) => pair.distance),
    [12.1, 12.1, 12.1, 12.1],
  );
  assert.deepEqual(consensus.pairs[0].samples, [12]);
  assert.equal(combineTdrCaptures(outlier, []), outlier);
});
