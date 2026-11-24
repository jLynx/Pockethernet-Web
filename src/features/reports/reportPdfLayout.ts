import type { jsPDF } from 'jspdf';
import type { SavedReport } from '@/app/types';
import { drawReportPhotos } from './reportPdfPhotos';
import { drawFlowingSections } from './reportPdfFlow';
import { reportPdfSections, type ReportPdfSection } from './reportPdfSections';
import { drawBrand, line, PDF_MARGIN, PDF_WIDTH, REPORT_COLORS, wrap } from './reportPdfPrimitives';
import { reportPdfVerdicts } from './reportPdfVerdicts';

function reportDetails(report: SavedReport): ReportPdfSection {
  const date = new Date(report.createdAt);
  const pad = (value: number): string => value.toString().padStart(2, '0');
  const stamp = Number.isNaN(date.valueOf())
    ? report.createdAt
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}  ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const details = report.details;
  return {
    title: 'Report details',
    pairedRows: [
      [
        ['Date', stamp],
        ['Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone],
        ['User', details.user],
        ['Cable ID', details.tag],
      ],
      [
        ['Project', details.project || report.job?.name || ''],
        ['Address', details.address],
        ['Location', details.location],
        ['Port ID', details.portId],
      ],
    ],
    rows: details.comment.trim() ? [['Comment', details.comment]] : [],
  };
}

function fitHeading(doc: jsPDF, text: string, width: number): string {
  const line = text.replace(/\s+/g, ' ').trim();
  if (doc.getTextWidth(line) <= width) return line;
  const [first] = wrap(doc, line, width - doc.getTextWidth('...'));
  return `${first.trimEnd()}...`;
}

function drawPageHeader(
  doc: jsPDF,
  report: SavedReport,
  logoDataUrl: string,
  showFooterLogo: boolean,
): number {
  const { tag, portId, location, project } = report.details;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(REPORT_COLORS.muted);
  doc.text('MEASUREMENT REPORT', PDF_MARGIN, 9.8);
  doc.setFontSize(18);
  doc.setTextColor(REPORT_COLORS.ink);
  const identity = tag || portId || location || project || 'Cable measurement';
  doc.text(fitHeading(doc, identity, 128), PDF_MARGIN, 18.4);
  const subtitle = [
    tag && portId && `Port ${portId}`,
    location !== identity && location,
    project !== identity && project,
  ]
    .filter(Boolean)
    .join('  ·  ');
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(REPORT_COLORS.muted);
    doc.text(fitHeading(doc, subtitle, 128), PDF_MARGIN, 23.7);
  }
  drawBrand(doc, logoDataUrl);
  line(doc, 27.3);
  line(doc, 292);
  if (showFooterLogo) {
    doc.setFillColor('#ffffff');
    doc.rect(85, 287, 40, 9, 'F');
    drawBrand(doc, logoDataUrl, true);
  }
  return 31;
}

function drawVerdict(
  doc: jsPDF,
  y: number,
  { overall, tests, failed, incomplete }: ReturnType<typeof reportPdfVerdicts>,
): number {
  const count = tests.size ? `${tests.size} test${tests.size === 1 ? '' : 's'}` : '';
  const details = [
    overall === 'recorded' && !count ? 'NO RESULTS' : overall.toUpperCase(),
    failed ? `${failed} failed` : '',
    incomplete ? `${incomplete} incomplete` : '',
    count,
  ]
    .filter(Boolean)
    .join('  ·  ');
  doc.setFillColor(REPORT_COLORS[overall]);
  doc.roundedRect(PDF_MARGIN, y, PDF_WIDTH, 8, 0.9, 0.9, 'F');
  const iconX = PDF_MARGIN + 3;
  const iconY = y + 2.4;
  doc.setDrawColor('#ffffff');
  doc.setLineWidth(0.34);
  doc.roundedRect(iconX, iconY, 3.3, 3.3, 0.35, 0.35, 'S');
  if (overall === 'pass') {
    doc.line(iconX + 0.7, iconY + 1.65, iconX + 1.4, iconY + 2.35);
    doc.line(iconX + 1.4, iconY + 2.35, iconX + 2.65, iconY + 0.85);
  } else if (overall === 'fail') {
    doc.line(iconX + 0.85, iconY + 0.85, iconX + 2.45, iconY + 2.45);
    doc.line(iconX + 0.85, iconY + 2.45, iconX + 2.45, iconY + 0.85);
  } else {
    doc.line(iconX + 0.8, iconY + 1.65, iconX + 2.5, iconY + 1.65);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.3);
  doc.setTextColor('#ffffff');
  doc.text(details, iconX + 5.5, y + 5.15);
  return y + 11;
}

export function drawReportPage(
  doc: jsPDF,
  report: SavedReport,
  logoDataUrl: string,
  showFooterLogo = true,
): void {
  const header = (): number => drawPageHeader(doc, report, logoDataUrl, showFooterLogo);
  const newPage = (): number => {
    doc.addPage();
    return header();
  };
  const verdict = reportPdfVerdicts(report);
  const start = drawVerdict(doc, header(), verdict);
  const details = reportDetails(report);
  const sections = reportPdfSections(report, verdict.tests);
  const run = sections[0];
  if (run?.title === 'Run status' && !run.summary && run.rows.length === 1) {
    details.rows.unshift(...run.rows);
    sections.shift();
  }
  const measurementsStart = drawFlowingSections(doc, [details], start, newPage);
  const resultsEnd = drawFlowingSections(doc, sections, measurementsStart, newPage);
  drawReportPhotos(doc, report.photos, resultsEnd + 2, newPage);
}
