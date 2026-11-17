import type { jsPDF } from 'jspdf';
import type { SavedReport } from '@/app/types';
import { drawReportPhotos } from './reportPdfPhotos';
import { drawFlowingSections } from './reportPdfFlow';
import { reportPdfSections } from './reportPdfSections';
import { BLUE, drawBrand, line, textLine, TEXT_LINE_HEIGHT, wrap } from './reportPdfPrimitives';

function drawMetadata(doc: jsPDF, report: SavedReport, newPage: () => void): number {
  const date = new Date(report.createdAt);
  const pad = (value: number): string => value.toString().padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} - ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  let leftEnd = textLine(doc, 'Date: ', stamp, 12, 24, 58);
  if (report.details.user) leftEnd = textLine(doc, 'User: ', report.details.user, 12, leftEnd, 58);
  let middleEnd = 24;
  for (const [label, value] of [
    ['Project: ', report.details.project ?? ''],
    ['Address: ', report.details.address],
    ['Location: ', report.details.location],
    ['Port ID: ', report.details.portId],
  ]) {
    if (value) middleEnd = textLine(doc, label, value, 75, middleEnd, 58);
  }
  const rightEnd = report.details.tag
    ? textLine(doc, 'Cable ID: ', report.details.tag, 140, 24, 58)
    : 24;
  let cursor = Math.max(leftEnd, middleEnd, rightEnd);
  const drawBorder = (): void => {
    doc.setDrawColor(BLUE);
    doc.setLineWidth(0.4);
    doc.rect(10, 21, 190, cursor - 21);
  };
  if (!report.details.comment.trim()) {
    drawBorder();
    return cursor;
  }
  const label = 'Comment: ';
  const lines = wrap(doc, report.details.comment, 186 - doc.getTextWidth(label));
  for (let first = 0; first < lines.length;) {
    const capacity = Math.max(1, Math.floor((280 - cursor) / TEXT_LINE_HEIGHT));
    const chunk = lines.slice(first, first + capacity);
    cursor = textLine(doc, label, chunk.join('\n'), 12, cursor, 186);
    first += chunk.length;
    drawBorder();
    if (first < lines.length) {
      newPage();
      cursor = 24;
    }
  }
  return cursor;
}

function drawPageHeader(doc: jsPDF, logoDataUrl: string, showFooterLogo: boolean): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('Measurement report', 12, 15);
  drawBrand(doc, logoDataUrl);
  line(doc, 292);
  if (showFooterLogo) {
    doc.setFillColor(255, 255, 255);
    doc.rect(85, 287, 40, 9, 'F');
    drawBrand(doc, '', true);
  }
}

export function drawReportPage(
  doc: jsPDF,
  report: SavedReport,
  logoDataUrl: string,
  showFooterLogo = true,
): void {
  const newPage = (): void => {
    doc.addPage();
    drawPageHeader(doc, logoDataUrl, showFooterLogo);
  };
  drawPageHeader(doc, logoDataUrl, showFooterLogo);
  const metadataEnd = drawMetadata(doc, report, newPage);
  const resultsEnd = drawFlowingSections(doc, reportPdfSections(report), metadataEnd + 5, newPage);
  drawReportPhotos(doc, report.photos, resultsEnd, newPage);
}
