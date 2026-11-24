import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PACKET } from '@/protocol/constants';
import { parseDiscoverySegment } from '@/protocol/discoverySegment';
import {
  discoveryStartCommand,
  parseDiscoveryHosts,
  parseDiscoveryProgress,
} from '@/protocol/networkDiscovery';
import { lookupDiscoveryVendor } from '@/protocol/discoveryVendors';
import { finishWithClock, measurementHarness } from './measurementTestHarness';
import { linkPacket } from './measurementFixtures';
import { runMeasurements } from './runMeasurements';

function deviceInfo(espVersion: number) {
  return { espVersion, stmVersion: 8, serial: 1, hardwareVersion: 2, mac: '00:00:00:00:00:01' };
}

function hostPayload(token: number, hostname: string, mac: number[] = [0, 0, 12, 0, 0, 1]) {
  const name = new TextEncoder().encode(hostname);
  return Uint8Array.of(token, 192, 0, 2, 14, ...mac, 4, 0, 1, 1, name.length, ...name);
}

function segmentPayload(token: number) {
  const igmp = Uint8Array.of(192, 0, 2, 1, 3, 125, 0, 125, 0, 4, 0, 32, 0, 0, 0);
  const stp = new Uint8Array(29);
  stp.set([2, 0x80, 1, 0, 0, 12, 0, 0, 2], 0);
  const ptp = new Uint8Array(52);
  ptp.set([2, 1, 7, 5, 0, 0, 12, 0, 0, 0, 0, 2]);
  return Uint8Array.of(
    token,
    1,
    0x10,
    0x27,
    0,
    0,
    6,
    0,
    1,
    2,
    100,
    0xb0,
    5,
    stp.length,
    ...stp,
    7,
    igmp.length,
    ...igmp,
    8,
    ptp.length,
    ...ptp,
    6,
    6,
    0x8e,
    0x88,
    3,
    0,
    0,
    0,
    99,
    2,
    0x12,
    0x34,
  );
}

void test('discovery requests encode legacy, v32 and listen-only method masks', () => {
  const baseline = discoveryStartCommand(13, true, 18, 3000).payload;
  const advanced = discoveryStartCommand(13, true, 32, 3000).payload;
  const passive = discoveryStartCommand(13, false, 32, 3000).payload;
  assert.deepEqual([...baseline.slice(0, 8)], [1, 13, 127, 0, 0, 1, 0xb8, 11]);
  assert.deepEqual([...advanced.slice(2, 4)], [0xff, 0x36]);
  assert.deepEqual([...advanced.slice(-4)], [5, 0, 0xc0, 0xba]);
  assert.deepEqual([...passive], [1, 13, 64, 0, 0, 1, 0xb8, 11, 0]);
});

void test('probe selections gate Layer 2 on V32 and omit IPv4 probes in monitor mode', () => {
  const mask = 1024 | 4 | 262144;
  const v18 = discoveryStartCommand(5, true, 18, 3000, mask).payload;
  const v32Monitor = discoveryStartCommand(5, false, 32, 3000, mask).payload;
  const v32 = discoveryStartCommand(5, true, 32, 3000, mask).payload;
  assert.deepEqual([...v18.slice(2, 4)], [69, 0]);
  assert.deepEqual([...v32Monitor.slice(2, 4)], [64, 4]);
  assert.deepEqual([...v32Monitor.slice(-4)], [0, 0, 192, 186]);
  assert.deepEqual([...v32.slice(2, 4)], [69, 4]);
  assert.deepEqual([...v32.slice(-4)], [4, 0, 192, 186]);
  assert.equal(v32Monitor[8], 0, 'layer 2 probes do not send mDNS queries');
});

void test('automatic mode can complete a five-minute IPv4-free monitor run', async () => {
  const run = measurementHarness(['network-discovery']);
  run.context.ble.info = deviceInfo(32);
  run.context.discoveryMode = 'auto';
  run.context.discoveryTimeout = 300000;
  run.setResponder((command) => {
    if (command.type !== PACKET.DISCOVERY_START) return run.respond(command);
    const token = command.payload[1];
    const payload = segmentPayload(token);
    new DataView(payload.buffer).setUint32(2, 300000, true);
    run.inbox.receive({ type: PACKET.DISCOVERY_SEGMENT, payload });
    run.inbox.receive({
      type: PACKET.DISCOVERY_DONE,
      payload: Uint8Array.of(token, 0, 64, 0, 0, 0, 0, 0),
    });
  });
  await finishWithClock(() => runMeasurements(run.context), 310);
  assert.equal(new DataView(run.sent[0].payload.buffer).getUint16(2, true) & 3, 1);
  assert.equal(run.sent[1].payload[2], 64);
  assert.equal(run.snapshot.results.networkDiscovery?.mode, 'passive');
  assert.equal(run.snapshot.results.networkDiscovery?.listenMs, 300000);
});

void test('Stop aborts an active discovery token, retains its hosts and shuts down Ethernet', async () => {
  const run = measurementHarness(['network-discovery']);
  run.context.ble.info = deviceInfo(32);
  run.context.discoveryTimeout = 10000;
  const runScope = new AbortController();
  run.context.signal = runScope.signal;
  run.setResponder((command) => {
    if (command.type === PACKET.DISCOVERY_ABORT) return;
    if (command.type !== PACKET.DISCOVERY_START) return run.respond(command);
    const token = command.payload[1];
    run.inbox.receive({ type: PACKET.DISCOVERY_HOST, payload: hostPayload(token, 'switch') });
    runScope.abort();
  });
  await finishWithClock(() => runMeasurements(run.context));
  assert.deepEqual(
    run.sent.map(({ type }) => type),
    [PACKET.ETH_CONFIG, PACKET.DISCOVERY_START, PACKET.DISCOVERY_ABORT, PACKET.ETH_STOP],
  );
  assert.equal(run.snapshot.results.networkDiscovery?.state, 'aborted');
  assert.equal(run.snapshot.results.networkDiscovery?.hosts.length, 1);
  assert.match(run.snapshot.error, /Measurement stopped/);
  assert.equal(run.inbox.busy, false);
});

void test('discovery parses token-matched host, progress and segment frames', () => {
  const host = parseDiscoveryHosts(hostPayload(1, 'switch'))[0];
  assert.equal(host.ip, '192.0.2.14');
  assert.equal(host.mac, '00:00:0C:00:00:01');
  assert.equal(host.identity.Hostname, 'switch');
  assert.deepEqual(
    parseDiscoveryProgress(Uint8Array.of(1, 0, 127, 0, 0, 0, 9, 0, 5, 0, 0, 0, 13, 0, 254, 0)),
    { methodsDone: 0x5007f, hosts: 9, probed: 13, total: 254 },
  );
  const { listenMs, observations } = parseDiscoverySegment(segmentPayload(1));
  assert.equal(listenMs, 10_000);
  assert.deepEqual(observations[0].fields, { VLAN: 100, Priority: 5, DEI: 1 });
  assert.equal(observations[1].fields.Protocol, 'RSTP');
  assert.equal(observations[1].fields['Root priority'], 32769);
  assert.equal(observations[2].fields.IP, '192.0.2.1');
  assert.equal(observations[2].fields['Advertised interval (s)'], 125);
  assert.equal(observations[3].fields.Domain, 7);
  assert.equal(observations[3].fields['Two-step'], 'Yes');
  assert.equal(observations[4].fields.Protocol, '802.1X (0x888E)');
  assert.deepEqual(observations[5].fields, { Data: '1234' });
  assert.throws(() => parseDiscoverySegment(segmentPayload(1).slice(0, -1)), /Truncated/);
  assert.equal(lookupDiscoveryVendor('00:00:0C:00:00:01', { '00000C': 'Cisco' }), 'Cisco');
  assert.equal(lookupDiscoveryVendor('02:00:00:00:00:01', { '020000': 'Private' }), undefined);
});

void test('v32 discovery collects notifications before ACK, ignores old tokens and saves observations', async () => {
  const run = measurementHarness(['network-discovery']);
  run.context.ble.info = deviceInfo(32);
  run.context.discoveryTimeout = 10000;
  run.setResponder((command) => {
    if (command.type !== PACKET.DISCOVERY_START) {
      run.respond(command);
      return;
    }
    const token = command.payload[1];
    run.inbox.receive({
      type: PACKET.DISCOVERY_HOST,
      payload: hostPayload((token + 1) & 255, 'old'),
    });
    run.inbox.receive({ type: PACKET.DISCOVERY_HOST, payload: hostPayload(token, 'switch') });
    run.inbox.receive({
      type: PACKET.DISCOVERY_HOST,
      payload: hostPayload(token, 'switch', [0, 0, 0, 0, 0, 0]),
    });
    run.inbox.receive({ type: PACKET.DISCOVERY_SEGMENT, payload: segmentPayload(token) });
    run.inbox.receive({
      type: PACKET.DISCOVERY_DONE,
      payload: Uint8Array.of(token, 0, 127, 0, 1, 0, 0, 0),
    });
  });
  await finishWithClock(() => runMeasurements(run.context));
  assert.deepEqual(
    run.sent.map((command) => command.type),
    [PACKET.ETH_CONFIG, PACKET.DISCOVERY_START, PACKET.ETH_STOP],
  );
  assert.equal(new DataView(run.sent[0].payload.buffer).getUint16(0, true), 1 | 8 | 512);
  const result = run.snapshot.results.networkDiscovery;
  assert.equal(result?.state, 'completed');
  assert.equal(result.mode, 'active');
  assert.equal(result.hosts.length, 1);
  assert.equal(result.hosts[0].mac, '00:00:0C:00:00:01');
  assert.equal(result.observations.length, 6);
  assert.equal(run.snapshot.results.ipv4, undefined);
  assert.equal(run.inbox.busy, false);
});

void test('discovery falls back to listening without DHCP and retains results after timeout and abort', async () => {
  const run = measurementHarness(['network-discovery']);
  run.context.ble.info = deviceInfo(18);
  run.context.discoveryTimeout = 10000;
  run.setResponder((command) => {
    if (command.type === PACKET.ETH_CONFIG) {
      run.inbox.receive(linkPacket());
      run.inbox.receive({ type: PACKET.ACK, payload: new Uint8Array() });
    } else if (command.type === PACKET.DISCOVERY_START) {
      assert.equal(command.payload[2], 64);
      run.inbox.receive({
        type: PACKET.DISCOVERY_HOST,
        payload: hostPayload(command.payload[1], 'switch'),
      });
    } else if (command.type === PACKET.DISCOVERY_ABORT) {
      const token = command.payload[0];
      run.inbox.receive({ type: PACKET.DISCOVERY_SEGMENT, payload: segmentPayload(token) });
      run.inbox.receive({
        type: PACKET.DISCOVERY_DONE,
        payload: Uint8Array.of(token, 2, 64, 0, 1, 0, 0, 0),
      });
    } else run.respond(command);
  });
  await finishWithClock(() => runMeasurements(run.context));
  assert.equal(run.snapshot.results.networkDiscovery?.state, 'timed-out');
  assert.equal(run.snapshot.results.networkDiscovery.passiveFallback, true);
  assert.equal(run.snapshot.results.networkDiscovery.hosts.length, 1);
  assert.equal(run.snapshot.results.networkDiscovery.observations.length, 6);
  assert.match(run.failures['network-discovery'] ?? '', /timed out/);
  assert.equal(run.inbox.busy, false);
});

void test('v17 skips Network Discovery without skipping other selected tests', async () => {
  const run = measurementHarness(['network-discovery', 'wiremap']);
  run.context.ble.info = deviceInfo(17);
  await runMeasurements(run.context);
  assert.match(run.failures['network-discovery'] ?? '', /firmware V18/);
  assert.ok(run.snapshot.results.wiremap);
  assert.deepEqual(
    run.sent.map((command) => command.type),
    [PACKET.WIREMAP],
  );
});
