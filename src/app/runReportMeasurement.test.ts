import assert from 'node:assert/strict';
import { test } from 'node:test';
import { measurementHarness, finishWithClock } from './measurementTestHarness';
import { workflowDraft, memoryStorage } from './workflowFixtures';
import { runReportMeasurement } from './runReportMeasurement';
import type { ReportDraft } from './types';
import { PACKET } from '@/pockethernetProtocol';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage() });

void test('each draft captures only its own run with the settings used at measurement time', async () => {
  const harness = measurementHarness(['wiremap']);
  harness.snapshot.results.tdr = { status: 'OK', summary: 'Previous cable', pairs: [], nvp: 71 };
  const context = {
    ...harness.context,
    toolSettings: { ...harness.context.toolSettings },
    discoveryTimeout: 10000 as const,
  };
  harness.setResponder((command) => {
    context.toolSettings.nvp = '45';
    context.selected.add('tdr');
    harness.respond(command);
  });
  let draft: ReportDraft = workflowDraft();
  await runReportMeasurement(context, (result) => {
    draft = result;
  });
  assert.equal(draft.results.tdr, null);
  assert.deepEqual(draft.selectedTests, ['wiremap']);
  assert.equal(draft.settings.nvp, '71');
  assert.equal(draft.measurementSettings.discoveryTimeout, 10000);
  assert.ok(draft.results.wiremap);
  assert.ok(draft.createdAt <= draft.completedAt);
});

void test('failed measurements remain saveable with their failure and interruption details', async () => {
  const harness = measurementHarness(['wiremap', 'poe']);
  harness.setResponder((command) => {
    if (command.type !== PACKET.POE) harness.respond(command);
  });
  let draft: ReportDraft = workflowDraft();
  await finishWithClock(() =>
    runReportMeasurement({ ...harness.context, discoveryTimeout: 30000 }, (result) => {
      draft = result;
    }),
  );
  assert.ok(draft.results.wiremap);
  assert.equal(draft.results.poe, null);
  assert.equal(draft.failures.poe, 'The device did not respond in time');
  assert.match(draft.runError, /completed with errors/);
});
