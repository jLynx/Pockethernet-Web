import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PACKET,
  pingCommand,
  tonerCommand,
  tonerMelodyCommand,
  wifiBridgeCommand,
} from '@/pockethernetProtocol';
import { DhcpVendorClass } from '@/features/settings/DhcpVendorClass';
import { ActionDock } from '@/shared/layout/AppControls';
import { lastTdrLength, wiremapPins } from './format';
import { discoveryLabel, normalizeMeasurementSettings } from './measurementSettings';
import { lldpPayload } from './measurementFixtures';
import { finishWithClock, measurementHarness } from './measurementTestHarness';
import { runMeasurements } from './runMeasurements';
import { restoreSelection } from './testSelection';

void test('legacy setup migrates to automatic discovery and splits saved neighbor tests', () => {
  const settings = normalizeMeasurementSettings({
    discoveryMode: 'active',
    discoveryTimeout: 30000,
  });
  assert.equal(settings.discoveryMode, 'auto');
  assert.equal(settings.discoveryTimeout, 30000);
  assert.equal(discoveryLabel(new Set(), settings.discoveryMode), 'Network Monitor');
  assert.equal(discoveryLabel(new Set(['ipv4']), settings.discoveryMode), 'Network Discovery');
  assert.deepEqual([...restoreSelection(['cdplldp'])], ['cdp', 'lldp', 'link']);
  assert.equal(
    normalizeMeasurementSettings({ discoveryMode: 'active', discoveryProbeMask: 0 }).discoveryMode,
    'active',
  );
  assert.equal(normalizeMeasurementSettings({ discoveryMode: 'passive' }).discoveryMode, 'passive');
});

void test('CDP and LLDP finish independently and the full listen keeps separate neighbors', async () => {
  const cdp = Uint8Array.of(
    1,
    0,
    12,
    204,
    204,
    204,
    0,
    12,
    1,
    2,
    3,
    4,
    0,
    17,
    0xaa,
    0xaa,
    3,
    0,
    0,
    12,
    32,
    0,
    2,
    180,
    0,
    0,
    0,
    1,
    0,
    5,
    67,
  );
  const run = measurementHarness(['cdp', 'lldp']);
  run.setResponder((command) => {
    run.respond(command);
    if (command.type === PACKET.ETH_CONFIG)
      run.inbox.receive({ type: PACKET.ETH_FILTER_MATCH, payload: cdp });
  });
  // No timer advances are needed when both first announcements arrive at setup.
  await runMeasurements(run.context);
  const cdpResult = run.snapshot.results.cdp;
  const lldpResult = run.snapshot.results.lldp;
  assert.ok(cdpResult?.status === 'OK' && lldpResult?.status === 'OK');
  assert.equal(cdpResult.protocol, 'CDP');
  assert.equal(lldpResult.protocol, 'LLDP');

  const full = measurementHarness(['lldp']);
  full.context.cdpLldpFull = true;
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const done = runMeasurements(full.context);
    await setImmediate();
    const anotherNeighbor = lldpPayload.slice();
    anotherNeighbor[11]++;
    full.inbox.receive({ type: PACKET.ETH_FILTER_MATCH, payload: anotherNeighbor });
    full.inbox.receive({ type: PACKET.ETH_FILTER_MATCH, payload: anotherNeighbor });
    mock.timers.tick(69_999);
    await setImmediate();
    assert.equal(Boolean(full.snapshot.results.lldp), false);
    mock.timers.tick(1);
    await done;
    assert.equal(full.snapshot.results.lldp?.announcements?.length, 2);
  } finally {
    mock.timers.reset();
  }
});

void test('Stop retains announcements received during a full listen', async () => {
  const run = measurementHarness(['lldp']);
  const scope = new AbortController();
  run.context.cdpLldpFull = true;
  run.context.signal = scope.signal;
  await finishWithClock(async () => {
    const done = runMeasurements(run.context);
    await setImmediate();
    scope.abort();
    await done;
  });
  assert.equal(run.snapshot.results.lldp?.announcements?.length, 1);
  assert.match(run.snapshot.error, /Measurement stopped/);
  assert.equal(run.sent[run.sent.length - 1]?.type, PACKET.ETH_STOP);
});

void test('Ping falls back to the public defaults only when the network supplied no targets', async () => {
  const run = measurementHarness(['ping']);
  run.context.ipv4Settings = {
    mode: 'static',
    ip: '192.0.2.2',
    netmask: '255.255.255.0',
    gateway: '0.0.0.0',
    dns: '0.0.0.0',
  };
  await runMeasurements(run.context);
  assert.deepEqual(
    run.sent.filter(({ type }) => type === PACKET.PING),
    [pingCommand('8.8.8.8'), pingCommand('1.1.1.1')],
  );
});

void test('the updated tool controls encode differential drive and the bridge channel', () => {
  const tone = new DataView(tonerCommand(5, 'off', '2', 'diff').payload.buffer);
  assert.equal(tone.getUint32(0, true), 15);
  assert.equal(tone.getUint32(4, true), 2);
  const melody = new DataView(tonerMelodyCommand('Test::c', 4, 'on', 'diff').payload.buffer);
  assert.equal(melody.getUint32(0, true), 28);
  assert.equal(melody.getUint32(4, true), 2);
  assert.equal(wifiBridgeCommand(true, 'Test', 'password123', 11).payload[103], 11);
  assert.throws(() => wifiBridgeCommand(true, 'Test', 'password123', 12), /channel/);
});

void test('setup exposes the DHCP gate, stop button, pin order and live NVP calculation', () => {
  const vendor = (firmwareVersion: number) =>
    renderToStaticMarkup(
      createElement(DhcpVendorClass, {
        firmwareVersion,
        value: '',
        onChange: () => {},
      }),
    );
  assert.match(vendor(17), /Requires firmware V18\+/);
  assert.match(vendor(18), /Cisco AP c9120/);
  assert.doesNotMatch(vendor(18), /Requires firmware/);
  const dock = renderToStaticMarkup(
    createElement(ActionDock, {
      running: true,
      canMeasure: true,
      selectedCount: 1,
      status: 'connected',
      onMeasure: () => {},
      onStop: () => {},
    }),
  );
  assert.match(dock, /class="measure-stop-button"[^>]*>Stop<\/button>/);
  assert.deepEqual(wiremapPins(false, 'sequential'), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(wiremapPins(true), [1, 2, 3, 6, 4, 5, 7, 8, 9]);
  const tdr = {
    status: 'OK',
    summary: '',
    nvp: 71,
    pairs: [
      { status: 'Open', distance: 20, samples: [] },
      { status: 'Open', distance: 30, samples: [] },
      { status: 'Terminated', distance: 1, samples: [] },
    ],
  } as const;
  const result = {
    ...tdr,
    pairs: tdr.pairs.map((pair) => ({ ...pair, samples: [...pair.samples] })),
  };
  assert.equal(lastTdrLength(result, 71), 25);
  assert.equal(lastTdrLength(result, 79), 27);
});
