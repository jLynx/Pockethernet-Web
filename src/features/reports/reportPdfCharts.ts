import type { jsPDF } from 'jspdf';
import { distanceForUnits, distanceUnitLabel } from '@/app/format';
import type { TdrGraphResult, Units } from '@/app/types';
import { tdrSampleDistance } from '@/pockethernetProtocol';
import { pairColor } from './reportPdfPrimitives';

const CROSSTALK_COLORS = ['#000000', '#0000ff', '#00b8c8', '#d000d0', '#e32323', '#12a52b'];

export function drawTdrChart(
  doc: jsPDF,
  graph: TdrGraphResult | null,
  kind: 'impedance' | 'crosstalk',
  x: number,
  y: number,
  width: number,
  height: number,
  units: Units,
  tia: '568A' | '568B',
): void {
  const traces = graph?.[kind] ?? [];
  const left = x + 8;
  const top = y + 1;
  const right = x + width - 1;
  const bottom = y + height - 5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(left, top, right - left, bottom - top);
  doc.setFontSize(5.5);
  doc.setTextColor(0, 0, 0);
  doc.text(kind === 'impedance' ? 'Impedance' : 'Crosstalk', x + 1.7, y + height / 2, {
    angle: 90,
    align: 'center',
  });
  doc.text('Distance', left + (right - left) / 2, y + height - 1, { align: 'center' });
  if (!graph || traces.length === 0) return;
  const first = Math.min(32, Math.max(0, traces[0].length - 2));
  const count = Math.min(...traces.map((trace) => trace.length));
  const last = Math.max(first + 1, count - 1);
  const values = traces.flatMap((trace) => trace.slice(first, count));
  const min = Math.min(0, ...values);
  const max = kind === 'impedance' ? Math.max(100, ...values) : Math.max(1, ...values);
  const range = Math.max(1, max - min);
  const xFor = (sample: number): number =>
    left + ((sample - first) / (last - first)) * (right - left);
  const yFor = (value: number): number => bottom - ((value - min) / range) * (bottom - top);
  doc.setDrawColor(205, 205, 205);
  doc.setLineWidth(0.15);
  for (let part = 1; part < 4; part += 1) {
    const gridX = left + ((right - left) * part) / 4;
    const gridY = top + ((bottom - top) * part) / 4;
    doc.line(gridX, top, gridX, bottom);
    doc.line(left, gridY, right, gridY);
  }
  traces.forEach((trace, traceIndex) => {
    doc.setDrawColor(
      kind === 'impedance'
        ? pairColor(tia, traceIndex)
        : (CROSSTALK_COLORS[traceIndex] ?? '#000000'),
    );
    doc.setLineWidth(0.35);
    for (let sample = first + 1; sample < count; sample += 1) {
      doc.line(
        xFor(sample - 1),
        yFor(trace[sample - 1] ?? 0),
        xFor(sample),
        yFor(trace[sample] ?? 0),
      );
    }
  });
  doc.setFontSize(4.8);
  doc.setTextColor(0, 0, 0);
  const distance = distanceForUnits(tdrSampleDistance(last, graph.nvp), units);
  doc.text('0', left, bottom + 2.5, { align: 'center' });
  doc.text(`${(distance / 2).toFixed(1)}`, left + (right - left) / 2, bottom + 2.5, {
    align: 'center',
  });
  doc.text(`${distance.toFixed(1)} ${distanceUnitLabel(units)}`, right, bottom + 2.5, {
    align: 'center',
  });
}
