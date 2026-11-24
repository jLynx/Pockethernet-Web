import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { workflowReport } from '@/app/workflowFixtures';
import type * as ReportExport from './reportDataExport';

const bundled = await build({
  entryPoints: ['src/features/reports/reportDataExport.ts'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  loader: { '.png': 'dataurl' },
});
const module: { exports: Partial<typeof ReportExport> } = { exports: {} };
runInNewContext(bundled.outputFiles[0].text, { module, require: createRequire(import.meta.url) });
const { createReportCsv, createReportJson } = module.exports;
assert.ok(createReportCsv && createReportJson);

void test('report data exports preserve ordering, project numbers, discovery fields and attachments', () => {
  const first = workflowReport('test-first', '=first');
  first.details.comment = 'rack, "north"\ncontrol';
  first.job = { id: 'site-a', name: 'Site A', number: 42 };
  first.selectedTests = ['network-discovery'];
  first.results.networkDiscovery = {
    status: 'OK',
    summary: '1 host, 1 segment observation',
    state: 'completed',
    mode: 'active',
    listenMs: 130_000,
    hosts: [
      {
        ip: '192.0.2.14',
        mac: '00:00:0C:00:00:01',
        vendor: 'Cisco',
        identity: { Hostname: 'lab-switch' },
        methods: 1,
        services: [],
        devices: {},
        unknown: [],
      },
    ],
    observations: [{ type: 1, label: 'VLAN', key: '1:100', fields: { VLAN: 100 } }],
  };
  const second = workflowReport('test-second', 'CAB-2');
  const csv = createReportCsv([first, second]);
  assert.ok(csv.indexOf(first.id) < csv.indexOf(second.id));
  assert.match(csv, /'=first/);
  assert.match(csv, /"rack, ""north""\ncontrol"/);
  assert.match(csv, /,Project sequence,42\r\n/);
  assert.match(csv, /Network Discovery,192\.0\.2\.14 · Vendor,Cisco/);
  assert.match(csv, /Network Discovery,VLAN,VLAN 100/);
  assert.match(csv, /Network Discovery,IGMP querier status,None observed/);
  assert.match(csv, /Network Discovery,Summary,"1 host, 1 segment observation"/);
  const json: unknown = JSON.parse(createReportJson([first, second]));
  assert.deepEqual(json, { schemaVersion: 1, reports: [first, second] });
});
