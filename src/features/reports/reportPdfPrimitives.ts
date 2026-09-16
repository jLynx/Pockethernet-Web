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
  pins.forEach((pin, index) => {
    const lineY = y + 5 + index * 2.15;
    doc.setFontSize(4.5);
    doc.setTextColor(0, 0, 0);
    doc.text(pin === 9 ? 'S' : pin.toString(), x + 2, lineY + 0.6);
    doc.text(pin === 9 ? 'S' : pin.toString(), x + 31, lineY + 0.6);
    doc.setDrawColor(pinColors[index]);
    doc.setLineWidth(0.55);
    const destination = result.connections[pin];
    const targetIndex = pins.indexOf(destination);
    const targetY = targetIndex >= 0 ? y + 5 + targetIndex * 2.15 : lineY;
    doc.line(x + 6, lineY, x + 27, targetY);
    if (pin === 1 || pin === 3 || pin === 5 || pin === 7) {
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.22);
      doc.setLineDashPattern([1.2, 1.2], 0);
      doc.line(x + 6, lineY, x + 27, targetY);
      doc.setLineDashPattern([], 0);
    }
  });
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
