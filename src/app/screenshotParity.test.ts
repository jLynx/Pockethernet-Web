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
import { ConfigurePage } from '@/features/settings/ConfigurePage';
import { NvpCalibration } from '@/features/settings/NvpCalibration';
import { ActionDock } from '@/shared/layout/AppControls';
import { lastTdrLength, wiremapPins } from './format';
import { discoveryLabel, normalizeMeasurementSettings } from './measurementSettings';
import { lldpPayload } from './measurementFixtures';
import { finishWithClock, measurementHarness } from './measurementTestHarness';
import { runMeasurements } from './runMeasurements';
import { restoreSelection, testSelectionForDevice } from './testSelection';
import { useAppSettings } from './useAppSettings';

void test('Configure only shows the discovery firmware requirement for a connected older tester', () => {
  function ConfigureFixture({
    connected,
    firmwareVersion,
  }: {
    connected: boolean;
    firmwareVersion?: number;
  }) {
    const app = useAppSettings();
    return createElement(ConfigurePage, {
      app: { ...app, ...app.batchConfiguration, workflowMode: 'batch' },
      disabled: false,
      firmwareVersion: connected ? firmwareVersion : undefined,
      unavailableTests: testSelectionForDevice(
        app.batchConfiguration.selected,
        connected,
        firmwareVersion,
      ).unavailableTests,
      onToggle: () => {},
      onNotice: () => {},
    });
  }
  const render = (connected: boolean, firmwareVersion?: number) =>
    renderToStaticMarkup(createElement(ConfigureFixture, { connected, firmwareVersion }));
  assert.match(render(true, 17), /disabled=""\/>Network Monitor · Requires firmware V18\+/);
  assert.doesNotMatch(render(false, 17), /Firmware V18\+/i);
  assert.doesNotMatch(render(true, 18), /Firmware V18\+/i);
});

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

void test('vendor class pills reflect the firmware gate, presets and saved custom input', () => {
  const vendor = (firmwareVersion: number, value = '', custom = false) =>
    renderToStaticMarkup(
      createElement(DhcpVendorClass, {
        firmwareVersion,
        value,
        custom,
        onChange: () => {},
      }),
    );
  assert.match(vendor(17), /<fieldset[^>]*disabled=""/);
  assert.match(vendor(17), /Requires firmware V18\+/);
  assert.match(vendor(18), /aria-pressed="true">None<\/button>/);
  assert.match(vendor(18, 'Cisco AP c9120'), /aria-pressed="true" title="Cisco AP c9120">Cisco AP/);
  assert.doesNotMatch(vendor(18), /Requires firmware/);
  assert.doesNotMatch(vendor(18), /Custom vendor class/);
  assert.match(vendor(18, 'Custom test class'), /Custom vendor class/);
  const saved = normalizeMeasurementSettings({
    ipv4Settings: { vendorClass: 'Cisco AP c9120', vendorClassCustom: true },
  }).ipv4Settings;
  const restored = vendor(18, saved.vendorClass, saved.vendorClassCustom);
  assert.match(restored, /aria-pressed="true">Custom<\/button>/);
  assert.match(restored, /Custom vendor class/);
});

void test('setup exposes the stop button, pin order and live NVP calculation', () => {
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
  const calibration = renderToStaticMarkup(
    createElement(NvpCalibration, {
      settings: { nvp: '79', units: 'feet', decimalSeparator: ',' },
      lastTdr: result,
      onChange: () => {},
    }),
  );
  assert.match(calibration, /aria-label="Decrease NVP"/);
  assert.match(calibration, /aria-label="Increase NVP"/);
  assert.match(calibration, /<output>88,6 ft<\/output>/);
});
