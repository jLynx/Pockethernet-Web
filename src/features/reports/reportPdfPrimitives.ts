import type { jsPDF } from 'jspdf';
import { distanceForUnits, distanceUnitLabel, pairColorsForTia } from '@/app/format';
import type { SavedReport, TiaStandard, Units } from '@/app/types';
import pockethernetWordmark from '@/assets/pockethernet-wordmark.png?inline';

export const BLUE = '#246fc5';
export const GREY = '#777777';

export function line(doc: jsPDF, y: number): void {
  doc.setDrawColor(128, 128, 128);
  doc.setLineWidth(0.25);
  doc.line(10, y, 200, y);
}

export function textLine(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width = 57,
  color = '#000000',
): number {
  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(BLUE);
  doc.text(label, x, y);
  const offset = doc.getTextWidth(label);
  doc.setTextColor(color);
  const wrapped = wrap(doc, value, Math.max(8, width - offset));
  doc.text(wrapped.slice(0, 3), x + offset, y);
  return y + Math.max(3.1, wrapped.slice(0, 3).length * 3.1);
}

export function sectionTitle(
  doc: jsPDF,
  title: string,
  summary: string,
  x: number,
  y: number,
  enabled: boolean,
  width = 57,
): number {
  if (!enabled) {
    doc.setTextColor(GREY);
    doc.setFontSize(7.2);
    doc.text(title, x, y);
    return y + 3.1;
  }
  return textLine(doc, `${title}: `, summary, x, y, width);
}

export function drawBrand(doc: jsPDF, logoDataUrl: string, footer = false): void {
  const x = footer ? 91 : 140;
  const y = footer ? 288.2 : 7;
  const maxWidth = footer ? 28 : 50;
  const maxHeight = footer ? 6 : 10;
  const source = logoDataUrl || pockethernetWordmark;
  try {
    const image = doc.getImageProperties(source);
    const ratio = image.width / image.height;
    const width = Math.min(maxWidth, maxHeight * ratio);
    const height = width / ratio;
    doc.addImage(source, image.fileType, x + (maxWidth - width) / 2, y, width, height);
  } catch {
    doc.setTextColor(12, 25, 43);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(footer ? 10 : 17);
    doc.text('Pockethernet', x, y + (footer ? 4.7 : 7));
  }
}

export function drawWiremap(doc: jsPDF, report: SavedReport, x: number, y: number): void {
  const result = report.results.wiremap;
  sectionTitle(doc, 'Wiremap', result?.summary ?? '', x, y, Boolean(result));
  if (!result) return;
  const pins = [1, 2, 3, 6, 4, 5, 7, 8, 9];
  const colors = pairColorsForTia(report.settings.tia);
  const pinColors = [
    colors[0],
    colors[0],
    colors[1],
    colors[1],
    colors[2],
    colors[2],
    colors[3],
    colors[3],
    '#222222',
  ];
  const striped = new Set([1, 3, 5, 7]);
  const lineY = (pin: number): number => y + 5 + pins.indexOf(pin) * 2.15;
  const drawWire = (
    pin: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): void => {
    doc.setDrawColor(pinColors[pins.indexOf(pin)]);
    doc.setLineWidth(0.55);
    if (striped.has(pin)) doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(startX, startY, endX, endY);
    doc.setLineDashPattern([], 0);
  };

  pins.forEach((pin) => {
    const pinY = lineY(pin);
    doc.setFontSize(4.5);
    doc.setTextColor(0, 0, 0);
    doc.text(pin === 9 ? 'S' : pin.toString(), x + 2, pinY + 0.6, { align: 'center' });
    doc.text(pin === 9 ? 'S' : pin.toString(), x + 55, pinY + 0.6, { align: 'center' });
    drawWire(pin, x + 5, pinY, x + 14, pinY);
    drawWire(pin, x + 43, pinY, x + 52, pinY);
  });

  pins.forEach((pin) => {
    const destination = result.connections[pin];
    if (destination > 0 && destination < 10) {
      drawWire(pin, x + 14, lineY(pin), x + 43, lineY(destination));
    } else if (destination === 255) {
      drawWire(pin, x + 14, lineY(pin), x + 27.5, lineY(pin));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(255, 0, 0);
      doc.text('?', x + 30, lineY(pin) + 0.7, { align: 'center' });
    }
  });

  const seenShorts = new Set<string>();
  pins.forEach((pin) => {
    const other = result.shorts[pin];
    if (!(other > 0 && other < 10)) return;
    const low = Math.min(pin, other);
    const high = Math.max(pin, other);
    const key = `${low}-${high}`;
    if (seenShorts.has(key)) return;
    seenShorts.add(key);
    const lowIndex = pins.indexOf(low);
    const shortX = lowIndex < 4 ? x + 15.5 + lowIndex * 1.6 : x + 36.5 + (lowIndex - 4) * 1.6;
    doc.setDrawColor(255, 0, 0);
    doc.setFillColor(255, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(shortX, lineY(low), shortX, lineY(high));
    doc.circle(shortX, lineY(low), 0.65, 'F');
    doc.circle(shortX, lineY(high), 0.65, 'F');
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`Wiremap ID: ${result.id}`, x + 2, y + 25.2);
}

export function formatDistance(value: number, units: Units): string {
  return `${distanceForUnits(value, units).toFixed(1)} ${distanceUnitLabel(units)}`;
}

export function pairColor(tia: TiaStandard, index: number): string {
  return pairColorsForTia(tia)[index] ?? '#000000';
}

export function field(record: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) if (record[key]) return record[key];
  return '';
}

export function wrap(doc: jsPDF, value: string, width: number): string[] {
  const result: unknown = doc.splitTextToSize(value, width);
  return Array.isArray(result) && result.every((item) => typeof item === 'string')
    ? result
    : [value];
}
