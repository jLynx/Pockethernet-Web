import type { jsPDF } from 'jspdf';
import { distanceForUnits, distanceUnitLabel, pairColorsForTia } from '@/app/format';
import type { TdrGraphResult, Units } from '@/app/types';
import { formatDecimal, type DecimalSeparator } from '@/app/numberFormat';
import { tdrSampleDistance } from '@/pockethernetProtocol';
import { tdrChartRange } from '@/app/tdrChartRange';

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
  separator: DecimalSeparator = '.',
): void {
  const traces = graph?.[kind] ?? [];
  const left = x + 1;
  const top = y + 1;
  const right = x + width - 1;
  const bottom = y + height - 5;
  doc.setDrawColor('#a8bacb');
  doc.setLineWidth(0.2);
  doc.rect(left, top, right - left, bottom - top);
  if (!graph || traces.length === 0 || traces.some((trace) => trace.length < 2)) return;
  const { firstSample: first, lastSample: last } = tdrChartRange(traces);
  const values = traces.flatMap((trace) => trace.slice(first, last + 1));
  const min = Math.min(0, ...values);
  const max = kind === 'impedance' ? Math.max(100, ...values) : Math.max(1, ...values);
  const range = Math.max(1, max - min);
  const distance = (sample: number): number =>
    distanceForUnits(tdrSampleDistance(sample, graph.nvp), units);
  const xMin = distance(first);
  const xMax = distance(last);
  const xFor = (sample: number): number =>
    left + ((distance(sample) - xMin) / Math.max(1, xMax - xMin)) * (right - left);
  const yFor = (value: number): number => bottom - ((value - min) / range) * (bottom - top);
  doc.setDrawColor('#d8e2eb');
  doc.setLineWidth(0.15);
  for (let part = 1; part < 4; part += 1) {
    const gridX = left + ((right - left) * part) / 4;
    const gridY = top + ((bottom - top) * part) / 4;
    doc.line(gridX, top, gridX, bottom);
    doc.line(left, gridY, right, gridY);
  }
  const pairColors = pairColorsForTia(tia);
  traces.forEach((trace, traceIndex) => {
    doc.setDrawColor(
      kind === 'impedance'
        ? (pairColors[traceIndex] ?? '#000000')
        : (CROSSTALK_COLORS[traceIndex] ?? '#000000'),
    );
    doc.setLineWidth(0.35);
    for (let sample = first + 1; sample <= last; sample += 1) {
      doc.line(
        xFor(sample - 1),
        yFor(trace[sample - 1] ?? 0),
        xFor(sample),
        yFor(trace[sample] ?? 0),
      );
    }
  });
  doc.setFontSize(4.8);
  doc.setTextColor('#526375');
  doc.text(formatDecimal(xMin, 1, separator), left, bottom + 2.7);
  doc.text(
    formatDecimal((xMin + xMax) / 2, 1, separator),
    left + (right - left) / 2,
    bottom + 2.7,
    {
      align: 'center',
    },
  );
  doc.text(
    `${formatDecimal(xMax, 1, separator)} ${distanceUnitLabel(units)}`,
    right,
    bottom + 2.7,
    {
      align: 'right',
    },
  );
}
