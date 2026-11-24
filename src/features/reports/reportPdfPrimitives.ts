import type { jsPDF } from 'jspdf';
import {
  distanceForUnits,
  distanceUnitLabel,
  pairColorsForTia,
  wiremapPairIndex,
  wiremapPins,
} from '@/app/format';
import type { SavedReport, TiaStandard, Units } from '@/app/types';
import { formatDecimal, type DecimalSeparator } from '@/app/numberFormat';
import logo from '@/assets/logo.png?inline';

export const PDF_MARGIN = 10;
export const PDF_WIDTH = 190;
export const PDF_BODY_BOTTOM = 280;
export const TEXT_LINE_HEIGHT = 3.1;
export const REPORT_COLORS = {
  ink: '#172536',
  muted: '#526375',
  rule: '#ccd7e0',
  tint: '#eaf0f5',
  pass: '#216744',
  fail: '#a2373a',
  incomplete: '#8b5613',
  recorded: '#40566e',
} as const;

export function line(doc: jsPDF, y: number): void {
  doc.setDrawColor(REPORT_COLORS.rule);
  doc.setLineWidth(0.25);
  doc.line(PDF_MARGIN, y, PDF_MARGIN + PDF_WIDTH, y);
}

export function drawBrand(doc: jsPDF, logoDataUrl: string, footer = false): void {
  const x = footer ? 91 : 146;
  const y = footer ? 288.2 : 9;
  const maxWidth = footer ? 28 : 53;
  const maxHeight = footer ? 6 : 16;
  const source = logoDataUrl || logo;
  try {
    const image = doc.getImageProperties(source);
    const ratio = image.width / image.height;
    const width = Math.min(maxWidth, maxHeight * ratio);
    const height = width / ratio;
    const left = footer ? x + (maxWidth - width) / 2 : x + maxWidth - width;
    doc.addImage(source, image.fileType, left, y + (maxHeight - height) / 2, width, height);
  } catch {
    doc.setTextColor(12, 25, 43);
    doc.setFont('helvetica', 'bold');
    const brand = 'Pocketweb for Pockethernet';
    const fontSize = footer ? 10 : 17;
    doc.setFontSize(fontSize);
    doc.setFontSize(Math.min(fontSize, (fontSize * maxWidth) / doc.getTextWidth(brand)));
    doc.text(brand, footer ? x : x + maxWidth, y + (footer ? 4.7 : 9), {
      align: footer ? 'left' : 'right',
    });
  }
}

export function drawWiremap(
  doc: jsPDF,
  report: SavedReport,
  x: number,
  y: number,
  width: number,
): void {
  const result = report.results.wiremap;
  if (!result) return;
  const diagramWidth = Math.min(width, 72);
  const at = (offset: number): number =>
    x + (width - diagramWidth) / 2 + (offset * diagramWidth) / 57;
  const pins = wiremapPins(report.settings.shieldTest !== false, report.settings.wiremapPinOrder);
  const colors = pairColorsForTia(report.settings.tia);
  const striped = new Set([1, 3, 5, 7]);
  const lineY = (pin: number): number => y + 5 + pins.indexOf(pin) * 2.15;
  const drawWire = (
    pin: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): void => {
    doc.setDrawColor(pin === 9 ? '#222222' : colors[wiremapPairIndex(pin)]);
    doc.setLineWidth(0.55);
    if (striped.has(pin)) doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(startX, startY, endX, endY);
    doc.setLineDashPattern([], 0);
  };

  pins.forEach((pin) => {
    const pinY = lineY(pin);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(0, 0, 0);
    doc.text(pin === 9 ? 'S' : pin.toString(), at(2), pinY + 0.6, { align: 'center' });
    doc.text(pin === 9 ? 'S' : pin.toString(), at(55), pinY + 0.6, { align: 'center' });
    drawWire(pin, at(5), pinY, at(14), pinY);
    drawWire(pin, at(43), pinY, at(52), pinY);
  });

  pins.forEach((pin) => {
    const destination = result.connections[pin];
    if (destination > 0 && destination < 10 && pins.includes(destination)) {
      drawWire(pin, at(14), lineY(pin), at(43), lineY(destination));
    } else if (destination === 255) {
      drawWire(pin, at(14), lineY(pin), at(27.5), lineY(pin));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(255, 0, 0);
      doc.text('?', at(30), lineY(pin) + 0.7, { align: 'center' });
    }
  });

  const seenShorts = new Set<string>();
  pins.forEach((pin) => {
    const other = result.shorts[pin];
    if (!(other > 0 && other < 10) || !pins.includes(other)) return;
    const low = Math.min(pin, other);
    const high = Math.max(pin, other);
    const key = `${low}-${high}`;
    if (seenShorts.has(key)) return;
    seenShorts.add(key);
    const lowIndex = pins.indexOf(low);
    const shortX = at(lowIndex < 4 ? 15.5 + lowIndex * 1.6 : 36.5 + (lowIndex - 4) * 1.6);
    doc.setDrawColor(255, 0, 0);
    doc.setFillColor(255, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(shortX, lineY(low), shortX, lineY(high));
    doc.circle(shortX, lineY(low), 0.65, 'F');
    doc.circle(shortX, lineY(high), 0.65, 'F');
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.4);
  doc.setTextColor(REPORT_COLORS.muted);
  doc.text(`Wiremap ID: ${result.id}`, at(2), y + 25.2);
}

export function formatDistance(
  value: number,
  units: Units,
  separator: DecimalSeparator = '.',
): string {
  return `${formatDecimal(distanceForUnits(value, units), 1, separator)} ${distanceUnitLabel(units)}`;
}

export function pairColor(tia: TiaStandard, index: number): string {
  const inks: Record<string, string> = {
    '#ff941e': '#9a4710',
    '#17a12a': '#15752c',
    '#a56a2c': '#86471b',
  };
  const color = pairColorsForTia(tia)[index] ?? REPORT_COLORS.ink;
  return inks[color] ?? color;
}

export function wrap(doc: jsPDF, value: string, width: number): string[] {
  const result: unknown = doc.splitTextToSize(value, width);
  return Array.isArray(result) && result.every((item) => typeof item === 'string')
    ? result
    : [value];
}
