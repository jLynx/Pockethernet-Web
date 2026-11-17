export function tdrChartRange(traces: number[][]): {
  firstSample: number;
  lastSample: number;
} {
  const count = traces.length ? Math.min(...traces.map((trace) => trace.length)) : 0;
  if (count < 2) return { firstSample: 0, lastSample: 0 };
  const firstSample = Math.min(32, count - 2);
  const values = traces.flatMap((trace) => trace.slice(firstSample, count));
  const fullRange = Math.max(0, ...values) - Math.min(0, ...values);
  const tolerance = Math.max(2, fullRange * 0.06);
  let signalEnd = firstSample;
  for (const trace of traces) {
    const tailValue = trace[count - 1];
    for (let sample = count - 1; sample >= firstSample; sample -= 1) {
      if (Math.abs(trace[sample] - tailValue) > tolerance) {
        signalEnd = Math.max(signalEnd, sample);
        break;
      }
    }
  }
  const margin = Math.max(10, Math.round((count - firstSample) * 0.08));
  const minimumEnd = Math.min(count - 1, firstSample + 20);
  return {
    firstSample,
    lastSample: Math.max(minimumEnd, Math.min(count - 1, signalEnd + margin)),
  };
}
