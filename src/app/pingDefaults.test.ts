import assert from 'node:assert/strict';
import type { PingDefaults } from './types';
import { initialPingTargets, updatePingTargets } from './pingDefaults';
import { loadPingDefaults } from './storage';

const disabled: PingDefaults = { enabled: false, targets: ['', '', ''] };
const enabled: PingDefaults = { enabled: true, targets: ['8.8.8.8', '8.8.4.4', '1.1.1.1'] };
assert.deepEqual(initialPingTargets(disabled), ['', '', '']);
assert.deepEqual(initialPingTargets(enabled), enabled.targets);
assert.deepEqual(updatePingTargets(['', '', ''], disabled, enabled), enabled.targets);
const changed: PingDefaults = { enabled: true, targets: ['9.9.9.9', '8.8.4.4', '1.0.0.1'] };
assert.deepEqual(
  updatePingTargets(['8.8.8.8', 'client.example.com', '1.1.1.1'], enabled, changed),
  ['9.9.9.9', 'client.example.com', '1.0.0.1'],
);
assert.deepEqual(
  updatePingTargets(['8.8.8.8', 'client.example.com', '1.1.1.1'], enabled, disabled),
  ['', 'client.example.com', ''],
);
assert.deepEqual(updatePingTargets(['192.0.2.1', '', ''], disabled, enabled), [
  '192.0.2.1',
  '8.8.4.4',
  '1.1.1.1',
]);
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let saved = '';
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => saved },
});
try {
  assert.deepEqual(loadPingDefaults(), disabled);
  saved = JSON.stringify(enabled);
  assert.deepEqual(loadPingDefaults(), enabled);
  saved = JSON.stringify({
    enabled: true,
    targets: [' 8.8.8.8 ', 123, 'a'.repeat(200), 'ignored'],
  });
  assert.deepEqual(loadPingDefaults(), {
    enabled: true,
    targets: ['8.8.8.8', '', 'a'.repeat(127)],
  });
  saved = '{broken';
  assert.deepEqual(loadPingDefaults(), disabled);
} finally {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}
console.log('Optional Ping defaults, persistence, and per-test overrides passed.');
