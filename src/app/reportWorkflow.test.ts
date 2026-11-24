import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSavedReport,
  incrementCableId,
  matchingCableReports,
  nextAvailableCableId,
  reportProjectNames,
} from './reportWorkflow';
import { workflowDraft, workflowReport } from './workflowFixtures';
import { assessWiremap } from './wiremapAcceptance';
import { normalizeSelection, testSelectionForDevice, toggleSelection } from './testSelection';
import { formatDecimal, formatScalar } from './numberFormat';

void test('increment preserves padding, prefix, and arbitrarily large numeric suffixes', () => {
  assert.equal(incrementCableId('CAB-009'), 'CAB-010');
  assert.equal(incrementCableId('Rack2-099'), 'Rack2-100');
  assert.equal(incrementCableId('CAB-999'), 'CAB-1000');
  assert.equal(incrementCableId('999999999999999999999'), '1000000000000000000000');
  assert.equal(incrementCableId('Cable A'), null);
});

void test('duplicate detection respects project and site, and the next ID skips occupied IDs', () => {
  const report = workflowReport();
  const next = workflowReport('report-2', 'CAB-002');
  assert.equal(
    matchingCableReports([report], { ...report.details, tag: ' cab-001 ', project: 'school' })
      .length,
    1,
  );
  assert.equal(matchingCableReports([report], { ...report.details, project: 'Office' }).length, 0);
  assert.equal(matchingCableReports([report], { ...report.details, address: 'Site B' }).length, 0);
  assert.equal(nextAvailableCableId('CAB-001', [report, next], report.details), 'CAB-003');
});

void test('the project filter groups legacy and linked reports and follows a saved project rename', () => {
  const legacy = workflowReport('legacy');
  const linked = { ...workflowReport('linked'), job: { id: 'school', name: 'School' } };
  const elsewhere = workflowReport('elsewhere');
  elsewhere.details.address = 'Site B';
  const project = { id: 'school', name: 'North Campus', site: 'Site A', numberPattern: '' };
  assert.deepEqual(
    [...reportProjectNames([legacy, linked, elsewhere], [project])],
    [
      ['legacy', 'North Campus'],
      ['linked', 'North Campus'],
      ['elsewhere', 'School'],
    ],
  );
  const renamed = { ...linked.details, project: project.name };
  assert.equal(matchingCableReports([linked], renamed, project.id).length, 1);
  assert.equal(nextAvailableCableId('CAB-000', [linked], renamed, project.id), 'CAB-002');
});

void test('saved reports freeze measurements, settings, details, photos, and failure metadata', () => {
  const draft = workflowDraft(),
    original = workflowReport();
  draft.failures = { tdr: 'Timed out' };
  draft.selectedTests.push('tdr');
  draft.runError = 'Completed with errors';
  const saved = createSavedReport(draft, original.details, original.photos, 'saved');
  draft.results.wiremap!.connections[1] = 8;
  draft.settings.nvp = '50';
  draft.failures.tdr = 'Changed';
  original.details.tag = 'Changed';
  original.photos[0].description = 'Changed';
  assert.equal(saved.results.wiremap!.connections[1], 1);
  assert.equal(saved.settings.nvp, '71');
  assert.equal(saved.details.tag, 'CAB-001');
  assert.equal(saved.photos[0].description, 'Port 24\nPatch panel');
  assert.equal(saved.failures?.tdr, 'Timed out');
  assert.equal(saved.createdAt, '2026-11-12T03:00:00.000Z');
  assert.throws(
    () => createSavedReport(workflowDraft(), { ...saved.details, tag: '' }, [], 'empty'),
    /Cable ID/,
  );
});

void test('wiremap rules handle crossover, pair requirements, shield, and shorts without changing measured pins', () => {
  const draft = workflowDraft(),
    result = draft.results.wiremap!;
  assert.equal(assessWiremap(result, { ...draft.settings, requiredPairs: '4' }).status, 'OK');
  assert.equal(assessWiremap(result, { ...draft.settings, shieldTest: true }).status, 'not_OK');
  const cross = {
    ...result,
    summary: '4-pair mixed crossover',
    connections: [0, 3, 6, 1, 4, 5, 2, 7, 8, 9],
  };
  assert.equal(
    assessWiremap(cross, { ...draft.settings, requiredPairs: '4', allowCrossover: true }).status,
    'OK',
  );
  assert.match(
    assessWiremap(cross, { ...draft.settings, allowCrossover: false }).summary,
    /Crossover not allowed/,
  );
  const two = {
    ...result,
    summary: '2-pair straight',
    connections: [0, 1, 2, 3, 0, 0, 6, 0, 0, 0],
  };
  assert.equal(assessWiremap(two, { ...draft.settings, requiredPairs: '2' }).status, 'OK');
  assert.equal(assessWiremap(two, { ...draft.settings, requiredPairs: '4' }).status, 'not_OK');
  const short = { ...result, shorts: [0, 9, 0, 0, 0, 0, 0, 0, 0, 1] };
  assert.equal(assessWiremap(short, { ...draft.settings, shieldTest: false }).status, 'not_OK');
  assert.deepEqual(result.connections, [0, 1, 2, 3, 4, 5, 6, 7, 8, 0]);
});

void test('persisted selections and toggles keep required network tests enabled', () => {
  const selected = normalizeSelection(['ping']);
  assert.deepEqual([...selected].sort(), ['ipv4', 'link', 'ping']);
  assert.ok(toggleSelection(selected, 'link').has('link'));
  assert.ok(toggleSelection(selected, 'ipv4').has('ipv4'));
  assert.ok(!toggleSelection(selected, 'ping').has('ping'));
});

void test('firmware availability filters the runnable tests without changing saved selections', () => {
  const preset = normalizeSelection(['network-discovery', 'ber', 'cdplldp']);
  const old = testSelectionForDevice(preset, true, 14);
  assert.deepEqual([...old.runnableTests], ['cdplldp', 'link']);
  assert.equal(old.unavailableTests.ber, 'Requires firmware V15+');
  assert.ok(testSelectionForDevice(preset, true, 15).runnableTests.has('ber'));
  const legacy = testSelectionForDevice(preset, true, 17);
  assert.deepEqual([...legacy.runnableTests], ['ber', 'cdplldp', 'link']);
  assert.equal(legacy.unavailableTests['network-discovery'], 'Requires firmware V18+');
  assert.ok(preset.has('network-discovery'));
  const available = { runnableTests: preset, unavailableTests: {} };
  assert.deepEqual(testSelectionForDevice(preset, true, 18), available);
  assert.deepEqual(testSelectionForDevice(preset, true, 32), available);
  assert.deepEqual(testSelectionForDevice(preset, false, undefined), available);
  const connecting = testSelectionForDevice(preset, true, undefined);
  assert.ok(!connecting.runnableTests.has('network-discovery'));
  assert.equal(connecting.unavailableTests['network-discovery'], 'Checking firmware version…');
  const discoveryOnly = normalizeSelection(['network-discovery']);
  assert.equal(testSelectionForDevice(discoveryOnly, true, 17).runnableTests.size, 0);
});

void test('decimal formatting preserves addresses, versions and free text', () => {
  assert.equal(formatDecimal(12.5, 1, ','), '12,5');
  assert.equal(formatScalar('0.002%', ','), '0,002%');
  assert.equal(formatScalar('192.168.1.1', ','), '192.168.1.1');
  assert.equal(formatScalar('Firmware 17.16', ','), 'Firmware 17.16');
});
