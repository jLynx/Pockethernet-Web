import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workflowReport } from '@/app/workflowFixtures';
import { sortReports } from './reportSort';

await test('Cable IDs sort naturally in either direction, with blank tags last and stable ties', () => {
  const reports = [
    workflowReport('ten', 'CAB-10'),
    workflowReport('blank', '  '),
    workflowReport('two', 'CAB-2'),
    workflowReport('two-again', ' cab-2 '),
    workflowReport('one', 'CAB-1'),
  ];
  assert.deepEqual(
    sortReports(reports, 'tag-asc').map((report) => report.id),
    ['one', 'two', 'two-again', 'ten', 'blank'],
  );
  assert.deepEqual(
    sortReports(reports, 'tag-desc').map((report) => report.id),
    ['ten', 'two', 'two-again', 'one', 'blank'],
  );
  assert.equal(reports[0].id, 'ten', 'Sorting must not mutate saved report order');
  assert.equal(reports[3].details.tag, ' cab-2 ', 'Sorting must not edit cable IDs');
});

await test('Date/time sorting compares instants, including timestamps with different offsets', () => {
  const reports = [
    { ...workflowReport('old'), createdAt: '2026-11-23T10:00:00+13:00' },
    { ...workflowReport('new'), createdAt: '2026-11-22T23:00:00Z' },
    { ...workflowReport('middle'), createdAt: '2026-11-22T22:00:00Z' },
  ];
  assert.deepEqual(
    sortReports(reports, 'date-asc').map((report) => report.id),
    ['old', 'middle', 'new'],
  );
  assert.deepEqual(
    sortReports(reports, 'date-desc').map((report) => report.id),
    ['new', 'middle', 'old'],
  );
});

await test('Selected PDF reports retain the displayed sort order after project filtering', () => {
  const reports = [
    workflowReport('ten', 'CAB-10'),
    {
      ...workflowReport('other', 'CAB-1'),
      details: { ...workflowReport().details, project: 'Other' },
    },
    workflowReport('two', 'CAB-2'),
    workflowReport('three', 'CAB-3'),
  ];
  const selected = new Set(['ten', 'other', 'two']);
  const visible = sortReports(
    reports.filter((report) => report.details.project === 'School'),
    'tag-asc',
  );
  assert.deepEqual(
    visible.filter((report) => selected.has(report.id)).map((report) => report.id),
    ['two', 'ten'],
  );
});
