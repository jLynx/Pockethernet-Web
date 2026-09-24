import { jsPDF } from 'jspdf';
import type { SavedReport } from '@/app/types';
import { drawReportPage } from './reportPdfLayout';

function filename(report: SavedReport): string {
  const label = report.details.tag || report.details.address || 'measurement';
  return `Pocketweb for Pockethernet ${label} ${report.createdAt.slice(0, 10)}`.replace(
    /[<>:"/\\|?*]+/g,
    '-',
  );
}

export function createReportsPdf(reports: SavedReport[], logoDataUrl: string): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  reports.forEach((report, index) => {
    if (index > 0) doc.addPage();
    drawReportPage(doc, report, logoDataUrl);
  });
  return doc;
}

export function downloadReportsPdf(reports: SavedReport[], logoDataUrl: string): void {
  if (reports.length === 0) return;
  const name =
    reports.length === 1
      ? filename(reports[0])
      : `Pocketweb for Pockethernet reports ${new Date().toISOString().slice(0, 10)}`;
  createReportsPdf(reports, logoDataUrl).save(`${name}.pdf`);
}

export async function shareReportPdf(report: SavedReport, logoDataUrl: string): Promise<boolean> {
  const file = new File(
    [createReportsPdf([report], logoDataUrl).output('blob')],
    `${filename(report)}.pdf`,
    {
      type: 'application/pdf',
    },
  );
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) return false;
  await navigator.share({ title: 'Pocketweb for Pockethernet measurement report', files: [file] });
  return true;
}

export function previewReportPdf(report: SavedReport, logoDataUrl: string): void {
  const url = URL.createObjectURL(createReportsPdf([report], logoDataUrl).output('blob'));
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
