import type { TdrResult } from '@/pockethernetProtocol';
import type { TiaStandard, Units } from './types';

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

export function tdrSummary(result: TdrResult, units: Units): string {
  if (result.summary === 'Mixed results') return result.summary;
  const average = result.pairs.reduce((sum, pair) => sum + pair.distance, 0) / result.pairs.length;
  return `${result.pairs[0].status} @ ${distanceForUnits(average, units).toFixed(1)} ${distanceUnitLabel(units)}`;
}
