import type { SavedReport } from '@/app/types';
import { reportPdfSections } from './reportPdfSections';
import { reportPdfVerdicts } from './reportPdfVerdicts';

type Cell = string | number;

function csvCell(value: Cell): string {
  let text = String(value);
  // Prevent device-supplied or user-supplied text from becoming a spreadsheet formula.
  if (typeof value === 'string' && /^(?:\s*[=+@-]|[\t\r\n])/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function createReportCsv(reports: readonly SavedReport[]): string {
  const rows: Cell[][] = [
    ['Report ID', 'Created', 'Project', 'Site', 'Cable ID', 'Section', 'Field', 'Value'],
  ];
  for (const report of reports) {
    const { project = '', address, tag, user, location, comment, portId } = report.details;
    const identity = [report.id, report.createdAt, project || report.job?.name || '', address, tag];
    for (const [field, value] of Object.entries({ user, location, comment, portId })) {
      if (value) rows.push([...identity, 'Report', field, value]);
    }
    if (report.job?.number !== undefined)
      rows.push([...identity, 'Report', 'Project sequence', report.job.number]);
    rows.push([...identity, 'Report', 'Selected tests', report.selectedTests?.join(', ') ?? '']);
    for (const section of reportPdfSections(report, reportPdfVerdicts(report).tests)) {
      if (section.summary) rows.push([...identity, section.title, 'Summary', section.summary]);
      for (const [field, value] of section.rows)
        rows.push([...identity, section.title, field || 'Summary', value]);
    }
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function createReportJson(reports: readonly SavedReport[]): string {
  return JSON.stringify({ schemaVersion: 1, reports }, null, 2) + '\n';
}
