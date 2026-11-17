import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tdrChartRange } from './tdrChartRange';

await test('short cable events trim the quiet tail with the UI margin', () => {
  for (const baseline of [0, 25]) {
    for (const pulse of [-100, 100]) {
      const trace = Array<number>(384).fill(baseline);
      trace.fill(baseline + pulse, 39, 46);
      // Small tail noise must not force the graph back to the full range.
      trace[300] = baseline + 1;
      assert.deepEqual(tdrChartRange([trace]), { firstSample: 32, lastSample: 73 });
    }
  }
});

await test('a later event on any pair extends the window', () => {
  const early = Array<number>(384).fill(0);
  early[45] = 100;
  const late = Array<number>(384).fill(0);
  late[200] = -50;
  assert.deepEqual(tdrChartRange([early, late]), { firstSample: 32, lastSample: 228 });
  late[382] = 50;
  assert.deepEqual(tdrChartRange([early, late]), { firstSample: 32, lastSample: 383 });
});

await test('flat traces keep a useful minimum window', () => {
  assert.deepEqual(tdrChartRange([Array<number>(384).fill(0)]), {
    firstSample: 32,
    lastSample: 60,
  });
});

await test('empty, short and unequal traces keep sample indices bounded', () => {
  for (const traces of [[], [[]], [[1]], [[1, 2], []]]) {
    assert.deepEqual(tdrChartRange(traces), { firstSample: 0, lastSample: 0 });
  }
  for (const count of [2, 12, 32, 33, 34, 40]) {
    const { firstSample, lastSample } = tdrChartRange([Array<number>(count).fill(0)]);
    assert.ok(firstSample >= 0 && firstSample < lastSample);
    assert.ok(lastSample < count);
  }
  const longer = Array<number>(384).fill(0);
  const shorter = Array<number>(64).fill(0);
  shorter[60] = 100;
  assert.deepEqual(tdrChartRange([longer, shorter]), { firstSample: 32, lastSample: 63 });
});
