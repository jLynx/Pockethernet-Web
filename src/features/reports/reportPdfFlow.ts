import type { jsPDF } from 'jspdf';
import type { ReportPdfRow, ReportPdfSection } from './reportPdfSections';
import { BLUE, TEXT_LINE_HEIGHT, wrap } from './reportPdfPrimitives';

const WIDTH = 186;
const BOTTOM = 280;

function fieldLines(
  doc: jsPDF,
  [label, value]: ReportPdfRow,
): {
  label: string[];
  values: string[];
  offset: number;
} {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const prefix = label ? `${label}: ` : '';
  const offset = doc.getTextWidth(prefix);
  const separate = offset > WIDTH / 2;
  return {
    label: separate ? wrap(doc, prefix, WIDTH) : [prefix],
    values: wrap(doc, value, separate ? WIDTH : WIDTH - offset),
    offset: separate ? 0 : offset,
  };
}

export function drawFlowingSections(
  doc: jsPDF,
  sections: ReportPdfSection[],
  y: number,
  newPage: () => void,
): number {
  let cursor = y;
  let activeTitle = '';
  const heading = (continued = false): void => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(BLUE);
    doc.text(`${activeTitle}${continued ? ' (continued)' : ''}`, 12, cursor);
    cursor += 4;
  };
  const ensureSpace = (height: number): boolean => {
    if (cursor + height <= BOTTOM) return false;
    newPage();
    cursor = 24;
    if (activeTitle) heading(true);
    return true;
  };
  const text = (value: string, x: number, color: string): void => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(color);
    doc.text(value, x, cursor);
  };
  const field = (row: ReportPdfRow): void => {
    const prepared = fieldLines(doc, row);
    const separate = prepared.label.length > 1 || (prepared.label[0] && prepared.offset === 0);
    if (separate) {
      for (const label of prepared.label) {
        ensureSpace(TEXT_LINE_HEIGHT);
        text(label, 12, BLUE);
        cursor += TEXT_LINE_HEIGHT;
      }
    }
    prepared.values.forEach((value, index) => {
      const continued = ensureSpace(TEXT_LINE_HEIGHT);
      if ((!separate && index === 0) || continued) text(prepared.label[0], 12, BLUE);
      // Long labels get their own line, including when a field continues on a new page.
      if (separate && continued) cursor += TEXT_LINE_HEIGHT;
      text(value, 12 + prepared.offset, row[2] ?? '#000000');
      cursor += TEXT_LINE_HEIGHT;
    });
  };
  for (const section of sections) {
    activeTitle = '';
    const height =
      4 +
      (section.graphic?.height ?? 0) +
      section.rows.reduce((sum, row) => {
        const prepared = fieldLines(doc, row);
        const labels = prepared.offset === 0 && row[0] ? prepared.label.length : 0;
        return sum + (labels + prepared.values.length) * TEXT_LINE_HEIGHT;
      }, 0);
    // Keep short sections together; longer fields can flow across as many pages as needed.
    ensureSpace(Math.min(height + 5, 30));
    if (height <= 80) ensureSpace(height + 5);
    activeTitle = section.title;
    heading();
    section.rows.forEach(field);
    if (section.graphic) {
      ensureSpace(section.graphic.height);
      section.graphic.draw(doc, cursor);
      cursor += section.graphic.height;
    }
    cursor += 5;
  }
  return cursor;
}
