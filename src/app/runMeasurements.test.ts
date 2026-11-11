import assert from 'node:assert/strict';
import { PACKET } from '@/pockethernetProtocol';
import { runMeasurements } from './runMeasurements';
import { finishWithClock, measurementHarness } from './measurementTestHarness';
import { linkPacket } from './measurementFixtures';
import type { TestId } from './types';

const ids = (run: ReturnType<typeof measurementHarness>): number[] =>
  run.sent.map((command) => command.type);
const cableSelection: TestId[] = ['wiremap', 'tdr', 'tdr-graph', 'poe'];

// Video's exact selection: same-pair and cross-pair TDR must complete before PoE starts.
const cable = measurementHarness(cableSelection);
await runMeasurements(cable.context);
assert.deepEqual(ids(cable), [
  PACKET.WIREMAP,
  PACKET.ETH_CONFIG,
  PACKET.TDR_SAME,
  PACKET.TDR_CROSS,
  PACKET.POE,
  PACKET.ETH_STOP,
]);
assert.deepEqual(
  cable.requests.map((request) => request.timeout),
  [5000, 3000, 5000, 8000, 15000, 5000],
);
assert.ok(cable.snapshot.results.tdr);
assert.ok(cable.snapshot.results.tdrGraph);
assert.equal(cable.snapshot.results.poe?.summary, 'No PoE');
assert.equal(cable.snapshot.results.poe.status, 'not_OK');
assert.equal(cable.snapshot.error, '');
assert.equal(cable.inbox.busy, false);
assert.ok(cable.expanded.has('tdr') && cable.expanded.has('tdr-graph'));

// Every combination of the four cable test switches, including graph without TDR.
for (let mask = 0; mask < 16; mask += 1) {
  const selected = cableSelection.filter((_id, index) => mask & (1 << index));
  const run = measurementHarness(selected);
  await runMeasurements(run.context);
  const expected: number[] = [];
  if (selected.includes('wiremap')) expected.push(PACKET.WIREMAP);
  if (selected.includes('tdr') || selected.includes('tdr-graph'))
    expected.push(PACKET.ETH_CONFIG, PACKET.TDR_SAME);
  if (selected.includes('tdr-graph')) expected.push(PACKET.TDR_CROSS);
  if (selected.includes('poe')) expected.push(PACKET.POE);
  if (expected.includes(PACKET.ETH_CONFIG)) expected.push(PACKET.ETH_STOP);
  assert.deepEqual(ids(run), expected, `Cable selection mask ${mask}`);
  assert.deepEqual(run.running, [true, false]);
}

// Each recoverable timeout must advance to the APK's next state, retaining earlier results.
for (const missing of [
  PACKET.WIREMAP,
  PACKET.ETH_CONFIG,
  PACKET.TDR_SAME,
  PACKET.TDR_CROSS,
  PACKET.POE,
]) {
  const run = measurementHarness([...cableSelection, 'link']);
  let suppressed = false;
  run.setResponder((command) => {
    if (command.type === missing && !suppressed) {
      suppressed = true;
      return;
    }
    run.respond(command);
  });
  await finishWithClock(() => runMeasurements(run.context));
  assert.equal(run.snapshot.results.link?.status, 'OK', `Timeout ${missing} aborted link test`);
  assert.match(run.snapshot.error, /completed with errors/);
  assert.equal(run.inbox.busy, false);
  assert.equal(ids(run).filter((type) => type === PACKET.ETH_STOP).length, 1);
  if (missing === PACKET.TDR_CROSS) {
    assert.ok(run.snapshot.results.tdr);
    assert.equal(run.snapshot.results.tdrGraph, null);
    assert.ok(run.failures['tdr-graph']);
    assert.equal(run.failures.tdr, undefined);
  }
  if (missing === PACKET.ETH_CONFIG || missing === PACKET.TDR_SAME) {
    assert.equal(ids(run).includes(PACKET.TDR_CROSS), false);
    assert.ok(run.failures.tdr && run.failures['tdr-graph']);
  }
  if (missing === PACKET.POE) assert.ok(run.snapshot.results.tdrGraph);
}

const rejected = measurementHarness(cableSelection);
rejected.setResponder((command) =>
  command.type === PACKET.POE
    ? rejected.inbox.receive({ type: PACKET.NACK, payload: new Uint8Array() })
    : rejected.respond(command),
);
await runMeasurements(rejected.context);
assert.ok(rejected.snapshot.results.tdrGraph);
assert.match(rejected.failures.poe ?? '', /rejected/);

// Disconnect/write failures must abort, rather than being treated as a harmless timeout.
const disconnected = measurementHarness(cableSelection);
disconnected.setResponder(() => {
  throw new Error('Pockethernet disconnected');
});
await runMeasurements(disconnected.context);
assert.deepEqual(ids(disconnected), [PACKET.WIREMAP]);
assert.match(disconnected.snapshot.error, /Measurement failed: Pockethernet disconnected/);
assert.equal(disconnected.inbox.busy, false);

// The network tests must share their DHCP stack, VLAN and filters; early replies must survive.
const network = measurementHarness([
  'link',
  'cdplldp',
  'vlan',
  'traffic',
  'ipv4',
  'ipv6',
  'ping',
  'extip',
]);
network.context.vlanSettings = { tagging: true, id: '200' };
await finishWithClock(() => runMeasurements(network.context));
assert.equal(ids(network).filter((type) => type === PACKET.ETH_CONFIG).length, 2); // Link test + one shared setup.
const configuration = network.sent.filter((command) => command.type === PACKET.ETH_CONFIG)[1];
const config = new DataView(configuration.payload.buffer);
assert.equal(config.getUint16(0, true), 1 | 8 | 32 | 64 | 256);
assert.equal(config.getUint16(2, true), 1 | 2 | 8 | 16 | 32);
assert.equal(config.getUint16(8, true), 200);
assert.equal(network.snapshot.results.ipv4?.fields['Your IP'], '192.0.2.20');
assert.equal(network.snapshot.results.ipv6?.results.length, 2);
assert.equal(network.snapshot.results.cdplldp?.summary, 'LLDP: sw1');
assert.deepEqual(network.snapshot.results.vlan?.tags, [{ id: 100, priority: 5, dei: true }]);
assert.equal(network.snapshot.results.traffic?.packets.length, 2);
assert.equal(network.snapshot.results.ping?.servers.length, 3);
assert.equal(network.snapshot.results.extip?.status, 'OK');
assert.ok(ids(network).indexOf(PACKET.PING) < ids(network).indexOf(PACKET.HTTP_RESPONSE)); // Actual numeric APK states 81–88 then 90.
assert.equal(network.snapshot.error, '');
assert.equal(network.inbox.busy, false);

// DHCPv6 timeout must keep the SLAAC reply; its APK deadline is 48 seconds.
const partialV6 = measurementHarness(['ipv6']);
partialV6.setResponder((command) => {
  if (command.type !== PACKET.ETH_CONFIG) {
    partialV6.respond(command);
    return;
  }
  const clone = { type: command.type, payload: command.payload.slice() };
  new DataView(clone.payload.buffer).setUint16(2, 25, true); // Respond only with SLAAC.
  partialV6.respond(clone);
});
await finishWithClock(() => runMeasurements(partialV6.context));
assert.equal(partialV6.snapshot.results.ipv6?.results[0].protocol, 'SLAAC');
assert.equal(partialV6.snapshot.results.ipv6.results.length, 1);
assert.equal(partialV6.snapshot.results.ipv6.status, 'not_OK');
assert.match(partialV6.snapshot.results.ipv6.summary, /No DHCPv6/);
assert.equal(partialV6.inbox.busy, false);

// Ping/External IP selected alone still need an interface/IP; blank ping slots use DHCP defaults.
for (const selection of [['ping'], ['extip']] as TestId[][]) {
  const run = measurementHarness(selection);
  await runMeasurements(run.context);
  assert.equal(ids(run)[0], PACKET.ETH_CONFIG);
  assert.equal(run.snapshot.results.ipv4?.status, 'OK');
  assert.equal(run.snapshot.error, '');
}
const pingTimeout = measurementHarness(['ping', 'extip']);
let firstPing = true;
pingTimeout.setResponder((command) => {
  if (command.type === PACKET.PING && firstPing) {
    firstPing = false;
    return;
  }
  pingTimeout.respond(command);
});
await finishWithClock(() => runMeasurements(pingTimeout.context));
assert.deepEqual(
  pingTimeout.snapshot.results.ping?.servers.map((server) => server.status),
  ['not_OK', 'OK', 'OK'],
);
assert.equal(pingTimeout.snapshot.results.extip?.status, 'OK');

const noDhcp = measurementHarness(['ipv4', 'ping', 'extip', 'ber']);
noDhcp.setResponder((command) => {
  if (command.type === PACKET.ETH_CONFIG) {
    noDhcp.inbox.receive(linkPacket());
    noDhcp.inbox.receive({ type: PACKET.ACK, payload: new Uint8Array() });
  } else noDhcp.respond(command);
});
await finishWithClock(() => runMeasurements(noDhcp.context));
assert.equal(ids(noDhcp).includes(PACKET.PING), false);
assert.equal(ids(noDhcp).includes(PACKET.HTTP_RESPONSE), false);
assert.equal(noDhcp.snapshot.results.ber?.completedBatches, 2);
assert.ok(noDhcp.failures.ipv4 && noDhcp.failures.ping && noDhcp.failures.extip);

// Network ACK and link failures must abort the network run and cancel passive listeners.
for (const mode of ['nack', 'no-link']) {
  const run = measurementHarness(['ipv4', 'ipv6', 'vlan', 'ber']);
  run.setResponder((command) => {
    if (command.type === PACKET.ETH_CONFIG)
      run.inbox.receive({
        type: mode === 'nack' ? PACKET.NACK : PACKET.ACK,
        payload: new Uint8Array(),
      });
    else run.respond(command);
  });
  await finishWithClock(() => runMeasurements(run.context));
  assert.match(run.snapshot.error, /Measurement failed/);
  assert.equal(ids(run).includes(PACKET.BER), false);
  assert.equal(run.inbox.busy, false);
}

const ber = measurementHarness(['ber']);
await runMeasurements(ber.context);
assert.equal(ber.snapshot.results.ber?.sent, 20000);
assert.equal(ber.snapshot.results.ber.received, 20000);
const loss = measurementHarness(['ber']);
let batch = 0;
loss.setResponder((command) => {
  if (command.type === PACKET.BER && batch++ === 1) loss.inbox.receive(linkPacket(false));
  else loss.respond(command);
});
await runMeasurements(loss.context);
assert.equal(loss.snapshot.results.ber?.completedBatches, 1);
assert.equal(loss.snapshot.results.ber.sent, 10000);
assert.match(loss.failures.ber ?? '', /link changed/);
assert.equal(loss.inbox.busy, false);
console.log('Measurement orchestration regression tests passed.');
