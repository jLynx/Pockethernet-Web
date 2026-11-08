import assert from 'node:assert/strict';
import { DEFAULT_TOOL_SETTINGS } from '@/app/storage';
import type { MeasurementContext } from '@/app/runMeasurements';
import type { WiremapResult } from '@/pockethernetProtocol';
import { captureRun, notificationSummary, type RunSnapshot } from './measurementNotifications';

const wiremap: WiremapResult = {
  status: 'not_OK',
  summary: 'Miswire',
  id: 2,
  adapterType: 2,
  connections: [0, 2, 1, 0, 4, 5, 255, 7, 8, 9],
  shorts: [0, 0, 0, 0, 5, 4, 0, 0, 0, 0],
};
const summary = notificationSummary({ results: { wiremap }, error: '' }, DEFAULT_TOOL_SETTINGS);
assert.match(summary, /1→2/);
assert.match(summary, /3 open/);
assert.match(summary, /4 short 5/);
assert.match(summary, /6 unknown/);
assert.match(summary, /Adapter ID: 2/);

const noop = (): void => {};
const unavailable = (): Promise<never> => Promise.reject(new Error('Disconnected'));
const context: MeasurementContext = {
  ble: {
    status: 'disconnected',
    device: null,
    info: null,
    error: '',
    clearError: noop,
    connect: unavailable,
    disconnect: noop,
    request: unavailable,
    send: unavailable,
    waitFor: unavailable,
    collectFor: unavailable,
  },
  selected: new Set(['wiremap']),
  setExpanded: noop,
  toolSettings: DEFAULT_TOOL_SETTINGS,
  berSettings: { speed: 1000, frameSize: 'both', payloadMode: 'random', total: 20000 },
  vlanSettings: { tagging: false, id: '' },
  ipv4Settings: { mode: 'dhcp', ip: '', netmask: '', gateway: '', dns: '' },
  ipv6Mode: 'slaac',
  pingTargets: [],
  setRunning: noop,
  setActiveTest: noop,
  setNotice: noop,
  setWiremap: noop,
  setTdr: noop,
  setTdrGraph: noop,
  setBer: noop,
  setPoe: noop,
  setLink: noop,
  setCdplldp: noop,
  setVlan: noop,
  setTraffic: noop,
  setIpv4: noop,
  setIpv6: noop,
  setPing: noop,
  setExtip: noop,
};
const first: RunSnapshot = { results: {}, error: '' };
const captured = captureRun(context, first);
captured.setWiremap(wiremap);
captured.setBer({
  sent: 10000,
  received: 10000,
  errors: 0,
  ratio: 0,
  errorRate: '0',
  summary: 'No errors',
  completedBatches: 1,
  batchCount: 2,
});
captured.setNotice('Measurement failed: Disconnected');
const interrupted = notificationSummary(first, DEFAULT_TOOL_SETTINGS);
assert.match(interrupted, /^Measurement failed: Disconnected/);
assert.match(interrupted, /Wiremap: Miswire/);
assert.match(interrupted, /1\/2 batches/);

// A subsequent run must never announce previous measurements as current results.
const second: RunSnapshot = { results: {}, error: '' };
const next = captureRun(context, second);
next.setPoe({
  status: 'not_OK',
  summary: 'No PoE',
  poeType: '',
  openVoltage: 0,
  loadVoltage: 0,
  polarity: '',
  adc: [],
  pairVoltages: [],
});
assert.doesNotMatch(notificationSummary(second, DEFAULT_TOOL_SETTINGS), /Wiremap|Error rate/);
captured.setWiremap(null);
assert.doesNotMatch(notificationSummary(first, DEFAULT_TOOL_SETTINGS), /Wiremap/);

assert.equal(
  notificationSummary(
    {
      results: {
        tdr: {
          status: 'OK',
          summary: 'Open',
          nvp: 71,
          pairs: [{ status: 'Open', distance: 10, samples: [] }],
        },
      },
      error: '',
    },
    { ...DEFAULT_TOOL_SETTINGS, units: 'feet' },
  ),
  'TDR: Open @ 32.8 ft',
);
console.log('Measurement notification tests passed.');
