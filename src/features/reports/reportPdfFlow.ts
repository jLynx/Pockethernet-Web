import type { jsPDF } from 'jspdf';
import type { ReportPdfRow, ReportPdfSection } from './reportPdfSections';
import {
  PDF_BODY_BOTTOM,
  PDF_MARGIN,
  PDF_WIDTH,
  REPORT_COLORS,
  TEXT_LINE_HEIGHT,
  wrap,
} from './reportPdfPrimitives';

const GUTTER = 3;
const PADDING = 2.6;
const HEADING_HEIGHT = 6.3;
const CARD_RADIUS = 1.25;
const CARD_BORDER = '#bac9d7';
const ROW_FONT = 7.2;

interface CardElement {
  height: number;
  draw: (doc: jsPDF, x: number, y: number) => void;
}

interface Card {
  section: ReportPdfSection;
  elements: CardElement[];
  next: number;
}

function wrapRow(doc: jsPDF, row: ReportPdfRow, width: number, alignCompact = true): CardElement[] {
  const [label, value, color = REPORT_COLORS.ink] = row;
  const bodyWidth = width - 2 * PADDING;
  const columnWidth = label ? Math.min(bodyWidth * 0.46, 40) : 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(ROW_FONT);
  const labels = label ? wrap(doc, label, columnWidth - 2) : [];
  const values = wrap(doc, value, bodyWidth - columnWidth);
  const alignRight = alignCompact && Boolean(label) && width < 110 && values.length === 1;
  return Array.from({ length: Math.max(labels.length, values.length) }, (_, index) => ({
    height: TEXT_LINE_HEIGHT,
    draw(pdf, x, y) {
      const baseline = y + 2.3;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(ROW_FONT);
      if (labels[index]) {
        pdf.setTextColor(REPORT_COLORS.muted);
        pdf.text(labels[index], x, baseline);
      }
      if (values[index]) {
        pdf.setTextColor(label ? color : REPORT_COLORS.ink);
        pdf.text(values[index], x + (alignRight ? bodyWidth : columnWidth), baseline, {
          align: alignRight ? 'right' : 'left',
        });
      }
    },
  }));
}

function prepareCard(doc: jsPDF, section: ReportPdfSection, width: number): Card {
  const rows = section.summary
    ? ([['', section.summary], ...section.rows] as ReportPdfRow[])
    : section.rows;
  const elements = rows.flatMap((row) => wrapRow(doc, row, width));
  if (section.pairedRows) {
    const [left, right] = section.pairedRows.map((group) =>
      group.flatMap((row) => (row[1].trim() ? wrapRow(doc, row, width / 2, false) : [])),
    );
    const pairs: CardElement[] = Array.from(
      { length: Math.max(left.length, right.length) },
      (_, index) => ({
        height: TEXT_LINE_HEIGHT,
        draw(pdf, x, y) {
          left[index]?.draw(pdf, x, y);
          right[index]?.draw(pdf, x + width / 2, y);
        },
      }),
    );
    elements.unshift(...pairs);
  }
  const graphic = section.graphic;
  if (graphic)
    elements.push({
      height: graphic.height,
      draw: (pdf, x, y) => graphic.draw(pdf, x, y, width - 2 * PADDING),
    });
  return { section, elements, next: 0 };
}

function drawCardPart(
  doc: jsPDF,
  card: Card,
  elements: CardElement[],
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  doc.saveGraphicsState();
  doc.roundedRect(x, y, width, height, CARD_RADIUS, CARD_RADIUS, null);
  doc.clip().discardPath();
  doc.setFillColor('#ffffff');
  doc.rect(x, y, width, height, 'F');
  doc.setFillColor(REPORT_COLORS.tint);
  doc.rect(x, y, width, HEADING_HEIGHT, 'F');
  doc.restoreGraphicsState();

  // Stroke the curve after the fills so the top edge stays distinct from the header.
  doc.setDrawColor(CARD_BORDER);
  doc.setLineWidth(0.28);
  doc.roundedRect(x, y, width, height, CARD_RADIUS, CARD_RADIUS, 'S');
  doc.setDrawColor(REPORT_COLORS.rule);
  doc.setLineWidth(0.17);
  doc.line(x, y + HEADING_HEIGHT, x + width, y + HEADING_HEIGHT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.3);
  doc.setTextColor(REPORT_COLORS.ink);
  doc.text(card.section.title + (card.next ? ' (continued)' : ''), x + PADDING, y + 4.15);
  const verdict = card.section.verdict;
  if (verdict && verdict !== 'recorded') {
    doc.setFontSize(6.4);
    doc.setTextColor(REPORT_COLORS[verdict]);
    doc.text(verdict.toUpperCase(), x + width - PADDING, y + 4, { align: 'right' });
  }
  let cursor = y + HEADING_HEIGHT + 1.45;
  for (const element of elements) {
    element.draw(doc, x + PADDING, cursor);
    cursor += element.height;
  }
}

function drawColumns(
  doc: jsPDF,
  groups: ReportPdfSection[][],
  top: number,
  newPage: () => number,
): number {
  if (!groups.length) return top;
  const width = (PDF_WIDTH - GUTTER * (groups.length - 1)) / groups.length;
  const columns = groups.map((group) =>
    group
      .map((section) => prepareCard(doc, section, width))
      .filter(({ elements }) => elements.length),
  );
  while (true) {
    let bottom = top;
    for (const [index, cards] of columns.entries()) {
      const x = PDF_MARGIN + index * (width + GUTTER);
      let y = top;
      while (cards.length) {
        const card = cards[0];
        const available = PDF_BODY_BOTTOM - y;
        const overhead = HEADING_HEIGHT + 3;
        const remainder = card.elements.slice(card.next);
        const fullHeight = remainder.reduce((sum, element) => sum + element.height, overhead);
        // Move compact cards as a unit. Long tables can continue across pages.
        if (fullHeight > available && fullHeight <= 72) break;
        let used = overhead;
        let end = 0;
        for (const element of remainder) {
          if (used + element.height > available) break;
          used += element.height;
          end++;
        }
        if (end === 0) break;
        drawCardPart(doc, card, remainder.slice(0, end), x, y, width, used);
        y += used + GUTTER;
        card.next += end;
        if (card.next !== card.elements.length) break;
        cards.shift();
      }
      bottom = Math.max(bottom, y);
    }
    if (columns.every((column) => column.length === 0)) return bottom;
    top = newPage();
  }
}

export function drawFlowingSections(
  doc: jsPDF,
  sections: ReportPdfSection[],
  y: number,
  newPage: () => number,
): number {
  const compact = ([0, 1, 2] as const)
    .map((column) => sections.filter((section) => section.column === column))
    .filter((column) => column.length > 0);
  const wide = sections.filter((section) => section.column === undefined);
  const cursor = drawColumns(doc, compact, y, newPage);
  return wide.length ? drawColumns(doc, [wide], cursor, newPage) : cursor;
}
