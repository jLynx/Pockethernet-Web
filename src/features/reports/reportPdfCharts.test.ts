import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsPDF } from 'jspdf';
import type { TdrGraphResult, Units } from '@/app/types';
import { drawTdrChart } from './reportPdfCharts';

function shortCableGraph(): TdrGraphResult {
  const trace = Array<number>(384).fill(0);
  trace.fill(100, 39, 46);
  return {
    impedance: Array.from({ length: 4 }, () => [...trace]),
    crosstalk: Array.from({ length: 6 }, () => [...trace]),
    nvp: 67,
  };
}

function chart(graph: TdrGraphResult, kind: 'impedance' | 'crosstalk', units: Units) {
  const doc = new jsPDF();
  drawTdrChart(doc, graph, kind, 12, 20, 90, 40, units, '568B', ',');
  return doc.output();
}

await test('both PDF graphs use the UI window and retain units, NVP and decimal preference', () => {
  for (const kind of ['impedance', 'crosstalk'] as const) {
    const graph = shortCableGraph();
    const feet = chart(graph, kind, 'feet');
    // Sample 73 at NVP 67: the UI window ends at 61.6 ft rather than 480.2 ft.
    assert.ok(feet.includes('(61,6 ft) Tj'));
    assert.ok(feet.includes('(-1,0) Tj'));
    assert.ok(feet.includes('(30,3) Tj'));
    assert.ok(!feet.includes('(480,2 ft) Tj'));
    assert.ok(chart(graph, kind, 'meters').includes('(18,8 m) Tj'));
    graph.nvp = 71;
    assert.ok(chart(graph, kind, 'feet').includes('(64,1 ft) Tj'));
    // Three vertical and three horizontal grid lines, then only visible samples.
    const segments = [...feet.matchAll(/ [\d.-]+ l\n/g)].length;
    assert.equal(segments, 6 + graph[kind].length * (73 - 32));
  }
});

await test('later cable events remain visible and short or incomplete traces export safely', () => {
  for (const kind of ['impedance', 'crosstalk'] as const) {
    const graph = shortCableGraph();
    graph[kind][graph[kind].length - 1][382] = -100;
    assert.ok(chart(graph, kind, 'feet').includes('(480,2 ft) Tj'));
    for (const traces of [
      [],
      [[]],
      [[1]],
      [[0, 1]],
      [
        [0, 1, 2],
        [0, 1],
      ],
    ]) {
      graph[kind] = traces;
      const output = chart(graph, kind, 'meters');
      assert.doesNotMatch(output, /NaN|Infinity/);
    }
  }
});
