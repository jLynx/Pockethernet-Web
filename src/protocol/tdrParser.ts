import type { TdrCrosstalkResult, TdrPairResult, TdrResult } from './types';

export function decompressTdr(payload: Uint8Array): number[] {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const samples: number[] = [];
  for (let offset = 0; offset + 1 < payload.length; offset += 2) {
    let word = view.getUint16(offset, true);
    if ((word & 0x8000) !== 0) {
      for (let index = 0; index < 3; index += 1) {
        let value = word & 0x0f;
        if ((word & 0x10) !== 0) value *= -1;
        samples.push(value);
        word >>>= 5;
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

export function parseTdrPacket(payload: Uint8Array, nvp = 71): TdrResult {
  const samples = decompressTdr(payload);
  const samplesPerPair = Math.trunc(samples.length / 4);
  if (samplesPerPair < 1) throw new Error('Invalid TDR response: no samples');
  const pairs = Array.from({ length: 4 }, (_, index) =>
    analyzeTdrPair(samples.slice(index * samplesPerPair, (index + 1) * samplesPerPair), nvp),
  );
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

export function parseTdrCrosstalkPacket(payload: Uint8Array, nvp = 71): TdrCrosstalkResult {
  const samples = decompressTdr(payload);
  const samplesPerTrace = Math.trunc(samples.length / 6);
  if (samplesPerTrace < 1) throw new Error('Invalid TDR crosstalk response: no samples');
  const traces = Array.from({ length: 6 }, (_, index) =>
    samples.slice(index * samplesPerTrace, (index + 1) * samplesPerTrace),
  );
  return { traces, nvp };
}
