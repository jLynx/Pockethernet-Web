import type { TdrResult } from '@/pockethernetProtocol';
import type { TiaStandard, Units } from './types';
import { formatDecimal, type DecimalSeparator } from './numberFormat';
import { tdrSampleDistance } from '@/pockethernetProtocol';

export function wiremapPins(
  showShield: boolean,
  order: 'pairwise' | 'sequential' = 'pairwise',
): number[] {
  const pins = order === 'sequential' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 6, 4, 5, 7, 8];
  if (showShield) pins.push(9);
  return pins;
}

export function wiremapPairIndex(pin: number): number {
  return pin < 3 ? 0 : pin === 3 || pin === 6 ? 1 : pin < 7 ? 2 : 3;
}

export function lastTdrLength(
  result: TdrResult | null | undefined,
  nvp: number,
): number | undefined {
  if (!result || !Number.isFinite(nvp) || nvp <= 0) return undefined;
  const distances = result.pairs
    .filter((pair) => pair.status && pair.status !== 'Terminated')
    .map((pair) =>
      pair.peakIndex === undefined
        ? (pair.distance * (100 + nvp - 71)) / (100 + result.nvp - 71)
        : tdrSampleDistance(pair.peakIndex, nvp),
    )
    .filter((distance) => Number.isFinite(distance) && distance > 0)
    .sort((a, b) => a - b);
  if (!distances.length) return undefined;
  return (
    (distances[Math.floor((distances.length - 1) / 2)] +
      distances[Math.floor(distances.length / 2)]) /
    2
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function pairColorsForTia(tia: TiaStandard = '568B'): string[] {
  return tia === '568A'
    ? ['#17a12a', '#ff941e', '#1049cf', '#a56a2c']
    : ['#ff941e', '#17a12a', '#1049cf', '#a56a2c'];
}

export function distanceForUnits(meters: number, units: Units): number {
  return units === 'feet' ? meters * 3.28084 : meters;
}

export function distanceUnitLabel(units: Units): 'ft' | 'm' {
  return units === 'feet' ? 'ft' : 'm';
}

export function tdrSummary(
  result: TdrResult,
  units: Units,
  separator: DecimalSeparator = '.',
): string {
  if (result.summary === 'Mixed results') return result.summary;
  const average = result.pairs.reduce((sum, pair) => sum + pair.distance, 0) / result.pairs.length;
  return `${result.pairs[0].status} @ ${formatDecimal(distanceForUnits(average, units), 1, separator)} ${distanceUnitLabel(units)}`;
}
