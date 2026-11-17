import type { WiremapResult } from '@/pockethernetProtocol';
import type { ToolSettings } from './types';

export function assessWiremap(result: WiremapResult, settings: ToolSettings): WiremapResult {
  const reasons: string[] = [];
  if (result.shorts.slice(1).some(Boolean)) reasons.push('Short circuit');
  if (settings.allowCrossover === false && result.summary.includes('crossover'))
    reasons.push('Crossover not allowed');
  const pins =
    settings.requiredPairs === '4'
      ? [1, 2, 3, 4, 5, 6, 7, 8]
      : settings.requiredPairs === '2'
        ? [1, 2, 3, 6]
        : [];
  const crossed: Record<number, number> = { 1: 3, 2: 6, 3: 1, 6: 2, 4: 7, 5: 8, 7: 4, 8: 5 };
  const straight = pins.every((pin) => result.connections[pin] === pin);
  const crossover =
    settings.allowCrossover !== false &&
    [1, 2, 3, 6].every((pin) => result.connections[pin] === crossed[pin]) &&
    (settings.requiredPairs !== '4' ||
      [4, 5, 7, 8].every((pin) => result.connections[pin] === pin) ||
      [4, 5, 7, 8].every((pin) => result.connections[pin] === crossed[pin]));
  if (pins.length && !straight && !crossover)
    reasons.push(`${settings.requiredPairs}-pair wiring requirement not met`);
  if (settings.shieldTest && result.connections[9] !== 9)
    reasons.push('Shield continuity required');
  const summary =
    settings.shieldTest === false ? result.summary.replace(/ \(S\)$/, '') : result.summary;
  return {
    ...result,
    status: reasons.length ? 'not_OK' : result.status,
    summary: reasons.length ? `${summary} · ${reasons.join('; ')}` : summary,
  };
}
