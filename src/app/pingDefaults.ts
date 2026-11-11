import type { PingDefaults } from './types';

export function initialPingTargets(defaults: PingDefaults): string[] {
  return defaults.enabled ? [...defaults.targets] : ['', '', ''];
}

export function updatePingTargets(
  current: string[],
  previous: PingDefaults,
  next: PingDefaults,
): string[] {
  return Array.from({ length: 3 }, (_, index) => {
    const value = current[index] ?? '';
    const followsDefault = previous.enabled && value === previous.targets[index];
    return !value || followsDefault ? (next.enabled ? next.targets[index] : '') : value;
  });
}
