import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { configurationKey, loadWorkflowMode } from './workflowMode';
import { loadToolSettings, loadReportDetails } from './storage';
import { loadMeasurementSettings } from './measurementSettings';
import { loadSelection } from './testSelection';
import { createSavedReport } from './reportWorkflow';
import { memoryStorage, workflowDraft, workflowReport } from './workflowFixtures';

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage() });
});

void test('workflow preference restores the original workflow while keeping existing batch users in batch mode', () => {
  assert.equal(loadWorkflowMode(), 'single');
  localStorage.setItem('pockethernet.selectedTests', '["wiremap"]');
  assert.equal(loadWorkflowMode(), 'batch');
  localStorage.setItem('pockethernet.workflowMode', '"single"');
  assert.equal(loadWorkflowMode(), 'single');
  localStorage.setItem('pockethernet.workflowMode', '"batch"');
  assert.equal(loadWorkflowMode(), 'batch');
});

void test('single configuration starts with existing preferences and subsequently keeps its changes separate', () => {
  localStorage.setItem('pockethernet.toolSettings', '{"nvp":"68","units":"feet"}');
  localStorage.setItem(
    'pockethernet.measurementSettings',
    '{"ipv4Settings":{"mode":"static","ip":"192.168.1.10"}}',
  );
  localStorage.setItem('pockethernet.reportDetails', '{"tag":"CAB-009","project":"School"}');
  localStorage.setItem('pockethernet.selectedTests', '["wiremap"]');
  const prefix = 'pockethernet.single.';
  assert.equal(loadToolSettings(configurationKey(prefix, 'toolSettings')).nvp, '68');
  assert.equal(
    loadMeasurementSettings(configurationKey(prefix, 'measurementSettings')).ipv4Settings.ip,
    '192.168.1.10',
  );
  assert.equal(loadReportDetails(configurationKey(prefix, 'reportDetails')).tag, 'CAB-009');
  localStorage.setItem(`${prefix}toolSettings`, '{"nvp":"55","units":"meters"}');
  localStorage.setItem(`${prefix}selectedTests`, '["ping"]');
  localStorage.setItem(`${prefix}reportDetails`, '{"tag":"Troubleshooting"}');
  assert.equal(loadToolSettings(configurationKey(prefix, 'toolSettings')).nvp, '55');
  assert.deepEqual([...loadSelection(configurationKey(prefix, 'selectedTests'))].sort(), [
    'ipv4',
    'link',
    'ping',
  ]);
  assert.equal(loadReportDetails(configurationKey(prefix, 'reportDetails')).tag, 'Troubleshooting');
  assert.equal(loadToolSettings().nvp, '68');
  assert.deepEqual([...loadSelection()], ['wiremap']);
  assert.equal(loadReportDetails().tag, 'CAB-009');
});

void test('single reports permit an optional tag while batch reports still require a Cable ID', () => {
  const details = { ...workflowReport().details, tag: '' };
  assert.equal(createSavedReport(workflowDraft(), details, [], 'single', false).details.tag, '');
  assert.throws(() => createSavedReport(workflowDraft(), details, [], 'batch'), /Cable ID/);
});
