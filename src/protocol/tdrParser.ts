import type { TdrCrosstalkResult, TdrPairResult, TdrResult } from './types';

export function decompressTdr(payload: Uint8Array, espVersion?: number): number[] {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const samples: number[] = [];
  for (let offset = 0; offset + 1 < payload.length; offset += 2) {
    let word = view.getUint16(offset, true);
    if ((word & 0x8000) !== 0) {
      const signBits = espVersion !== undefined && espVersion < 23 ? [4, 4, 9] : [4, 9, 14];
      for (let index = 0; index < 3; index += 1) {
        let value = (word >>> (index * 5)) & 0x0f;
        if (word & (1 << signBits[index])) value *= -1;
        samples.push(value);
      }
    } else if ((word & 0x4000) !== 0) {
      for (let index = 0; index < 2; index += 1) {
        let value = word & 0x3f;
        if ((word & 0x40) !== 0) value *= -1;
        samples.push(value);
        word >>>= 7;
      }
    } else if ((word & 0xfe00) === 0x3e00) {
      for (let index = 0; index <= (word & 0x01ff); index += 1) samples.push(0);
    } else {
      let value = word & 0xff;
      if ((word & 0x0100) !== 0) value *= -1;
      for (let index = 0; index <= ((word >>> 9) & 0x1f); index += 1) samples.push(value);
    }
  }
  return samples;
}

function tdrPeaks(samples: number[]): number[] {
  const peaks: number[] = [];
  let direction = 0;
  let previous = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index];
    if (direction === 0) {
      if (value !== previous) direction = previous = value;
      continue;
    }
    if (direction < 0) {
      if (value < previous) previous = value;
      else if (value > previous) {
        peaks.push(index - 1);
        direction = 1;
        previous = value;
      }
    } else if (value > previous) previous = value;
    else if (value < previous) {
      peaks.push(index - 1);
      direction = -1;
      previous = value;
    }
  }
  return peaks;
}

export function tdrSampleDistance(sampleIndex: number, nvp = 71): number {
  const factor = (nvp - 71) / 100 + 1;
  return sampleIndex < 50
    ? (sampleIndex * 0.4591 - 15.0243) * factor
    : (sampleIndex * 0.4288 - 11.76) * factor;
}

function analyzeTdrPair(samples: number[], nvp: number): TdrPairResult {
  const peaks = tdrPeaks(samples);
  if (!peaks.length) return { status: '', distance: 0, samples };
  let selectedPeak = 0;
  let selectedValue = 0;
  let selectedListIndex = 0;
  for (let index = peaks.length - 1; index >= 0; index -= 1) {
    const peak = peaks[index];
    const value = samples[peak];
    if (peak >= 32 && Math.abs(value) > Math.abs(selectedValue)) {
      selectedPeak = peak;
      selectedValue = value;
      selectedListIndex = index;
    }
  }
  if (selectedValue === 0) return { status: '', distance: 0, samples };
  if (selectedPeak < 50 && selectedListIndex < peaks.length - 1) {
    const nextPeak = peaks[selectedListIndex + 1];
    if (nextPeak - selectedPeak < 10) selectedPeak = Math.trunc((selectedPeak + nextPeak) / 2);
  }
  return {
    status: Math.abs(selectedValue) < 15 ? 'Terminated' : selectedValue < 0 ? 'Short' : 'Open',
    distance: Number(Math.max(0, tdrSampleDistance(selectedPeak, nvp)).toFixed(1)),
    peakIndex: selectedPeak,
    peakValue: selectedValue,
    samples,
  };
}

export function repairTdrSaturation(trace: number[]): number[] {
  const samples = [...trace];
  for (let start = 0; start < samples.length;) {
    if (samples[start] !== 0) {
      start += 1;
      continue;
    }
    let end = start + 1;
    while (end < samples.length && samples[end] === 0) end += 1;
    if (end - start <= 6 && (samples[start - 1] ?? 0) <= -64 && (samples[end] ?? 0) <= -64)
      samples.fill(-256, start, end);
    start = end;
  }
  return samples;
}

export function parseTdrPacket(payload: Uint8Array, nvp = 71, espVersion?: number): TdrResult {
  const samples = decompressTdr(payload, espVersion);
  const samplesPerPair = Math.trunc(samples.length / 4);
  if (samplesPerPair < 1) throw new Error('Invalid TDR response: no samples');
  const pairs = Array.from({ length: 4 }, (_, index) => {
    const trace = samples.slice(index * samplesPerPair, (index + 1) * samplesPerPair);
    return analyzeTdrPair(
      espVersion !== undefined && espVersion < 31 ? repairTdrSaturation(trace) : trace,
      nvp,
    );
  });
  return summarizePairs(pairs, nvp);
}

function summarizePairs(pairs: TdrPairResult[], nvp: number): TdrResult {
  let maxDifference = 0;
  let sameStatus = true;
  for (let left = 0; left < 4; left += 1) {
    for (let right = left + 1; right < 4; right += 1) {
      maxDifference = Math.max(
        maxDifference,
        Math.abs(pairs[left].distance - pairs[right].distance),
      );
      if (pairs[left].status !== pairs[right].status) sameStatus = false;
    }
  }
  if (maxDifference > 1.5 || !sameStatus)
    return { pairs, summary: 'Mixed results', status: 'not_OK', nvp };
  const average = pairs.reduce((sum, pair) => sum + pair.distance, 0) / 4;
  return { pairs, summary: `${pairs[0].status} @ ${average.toFixed(1)} m`, status: 'OK', nvp };
}

function pairAgrees(left: TdrPairResult, right: TdrPairResult): boolean {
  return (
    left.status === right.status &&
    Math.abs(left.distance - right.distance) <=
      0.2 + Number.EPSILON * Math.max(1, left.distance, right.distance)
  );
}

export function tdrCapturesAgree(left: TdrResult, right: TdrResult): boolean {
  return (
    left.pairs.length === right.pairs.length &&
    left.pairs.every((pair, index) => pairAgrees(pair, right.pairs[index]))
  );
}

export function combineTdrCaptures(first: TdrResult, additional: readonly TdrResult[]): TdrResult {
  if (!additional.length) return first;
  const captures = [first, ...additional];
  const pairs = first.pairs.map((pair, index) => {
    let agreeing: TdrPairResult[] = [];
    const candidates = captures.map((capture) => capture.pairs[index]);
    for (const candidate of candidates) {
      const group = candidates.filter((other) => pairAgrees(candidate, other));
      if (group.length > agreeing.length) agreeing = group;
    }
    if (agreeing.length < 2) return pair;
    const ordered = [...agreeing].sort((left, right) => left.distance - right.distance);
    const representative = ordered[Math.floor((ordered.length - 1) / 2)];
    const distance = ordered.reduce((sum, item) => sum + item.distance, 0) / ordered.length;
    return { ...representative, distance: Number(distance.toFixed(1)) };
  });
  return summarizePairs(pairs, first.nvp);
}

export function parseTdrCrosstalkPacket(
  payload: Uint8Array,
  nvp = 71,
  espVersion?: number,
): TdrCrosstalkResult {
  const samples = decompressTdr(payload, espVersion);
  const samplesPerTrace = Math.trunc(samples.length / 6);
  if (samplesPerTrace < 1) throw new Error('Invalid TDR crosstalk response: no samples');
  const traces = Array.from({ length: 6 }, (_, index) =>
    samples.slice(index * samplesPerTrace, (index + 1) * samplesPerTrace),
  );
  return { traces, nvp };
}
