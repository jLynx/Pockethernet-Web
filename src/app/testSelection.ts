import { SUPPORTED_TESTS, type TestId, type UnavailableTests } from './types';
import { firmwareUnavailableReason } from '@/protocol/firmwareFeatures';

const NETWORK_TESTS: readonly TestId[] = [
  'cdplldp',
  'cdp',
  'lldp',
  'vlan',
  'traffic',
  'ipv4',
  'ipv6',
  'ping',
  'extip',
];

export function normalizeSelection(ids: readonly TestId[]): Set<TestId> {
  const next = new Set(ids.filter((id) => SUPPORTED_TESTS.includes(id)));
  if (NETWORK_TESTS.some((id) => next.has(id))) next.add('link');
  if (next.has('ping') || next.has('extip')) next.add('ipv4');
  return next;
}

export function toggleSelection(current: Set<TestId>, id: TestId): Set<TestId> {
  const next = new Set(current);
  if (id === 'ipv4' && (next.has('ping') || next.has('extip'))) return next;
  if (id === 'link' && NETWORK_TESTS.some((test) => next.has(test))) return next;
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return normalizeSelection([...next]);
}

export function testSelectionForDevice(
  selected: Set<TestId>,
  connected: boolean,
  espVersion: number | undefined,
): { runnableTests: Set<TestId>; unavailableTests: UnavailableTests } {
  const unavailableTests: UnavailableTests = {};
  if (!connected) return { runnableTests: selected, unavailableTests };
  const runnableTests = new Set(selected);
  for (const [id, feature] of [
    ['network-discovery', 'discovery'],
    ['ber', 'ber'],
  ] as const) {
    const reason = firmwareUnavailableReason(espVersion, feature);
    if (!reason) continue;
    unavailableTests[id] = reason;
    runnableTests.delete(id);
  }
  return { runnableTests, unavailableTests };
}

export function loadSelection(key = 'pockethernet.selectedTests'): Set<TestId> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return restoreSelection(
      Array.isArray(saved) ? SUPPORTED_TESTS.filter((id) => saved.includes(id)) : [],
    );
  } catch {
    return new Set();
  }
}

export function restoreSelection(ids: readonly TestId[]): Set<TestId> {
  return normalizeSelection(
    ids.flatMap((id) => (id === 'cdplldp' ? (['cdp', 'lldp'] as const) : [id])),
  );
}
