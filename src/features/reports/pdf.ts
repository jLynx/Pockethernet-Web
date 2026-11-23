import { jsPDF } from 'jspdf';
import type { SavedReport } from '@/app/types';
import { drawReportPage } from './reportPdfLayout';
import { uniqueReportFilename, type ReportFile } from './reportFiles';

function filename(report: SavedReport): string {
  const label = report.details.tag || report.details.address || 'measurement';
  return `Pocketweb for Pockethernet ${label} ${report.createdAt.slice(0, 10)}`.replace(
    /[<>:"/\\|?*]+/g,
    '-',
  );
}

export function createReportsPdf(
  reports: SavedReport[],
  logoDataUrl: string,
  showFooterLogo = true,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  reports.forEach((report, index) => {
    if (index > 0) doc.addPage();
    drawReportPage(doc, report, logoDataUrl, showFooterLogo);
  });
  // Count after rendering: comments, measurements and photos can all add pages.
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#777777');
    doc.text(`Page ${page} of ${total}`, 198, 291, { align: 'right' });
  }
  return doc;
}

export function downloadReportsPdf(
  reports: SavedReport[],
  logoDataUrl: string,
  showFooterLogo = true,
): void {
  const used = new Set<string>();
  for (const report of reports) {
    createReportsPdf([report], logoDataUrl, showFooterLogo).save(
      uniqueReportFilename(filename(report), used),
    );
  }
}

export function reportPdfFiles(
  reports: SavedReport[],
  logoDataUrl: string,
  showFooterLogo = true,
): ReportFile[] {
  const used = new Set<string>();
  return reports.map((report) => ({
    name: uniqueReportFilename(filename(report), used),
    blob: () => createReportsPdf([report], logoDataUrl, showFooterLogo).output('blob'),
  }));
}

export function downloadCombinedReportsPdf(
  reports: SavedReport[],
  logoDataUrl: string,
  showFooterLogo = true,
): void {
  if (reports.length === 0) return;
  const name =
    reports.length === 1
      ? filename(reports[0])
      : `Pocketweb for Pockethernet reports ${new Date().toISOString().slice(0, 10)}`;
  createReportsPdf(reports, logoDataUrl, showFooterLogo).save(`${name}.pdf`);
}

export async function shareReportPdf(
  report: SavedReport,
  logoDataUrl: string,
  showFooterLogo = true,
): Promise<boolean> {
  const file = new File(
    [createReportsPdf([report], logoDataUrl, showFooterLogo).output('blob')],
    `${filename(report)}.pdf`,
    {
      type: 'application/pdf',
    },
  );
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) return false;
  await navigator.share({ title: 'Pocketweb for Pockethernet measurement report', files: [file] });
  return true;
}

export function previewReportPdf(
  report: SavedReport,
  logoDataUrl: string,
  showFooterLogo = true,
): void {
  const url = URL.createObjectURL(
    createReportsPdf([report], logoDataUrl, showFooterLogo).output('blob'),
  );
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
