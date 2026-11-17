import { SUPPORTED_TESTS, type TestId } from './types';

const NETWORK_TESTS: readonly TestId[] = [
  'cdplldp',
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

export function loadSelection(key = 'pockethernet.selectedTests'): Set<TestId> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return normalizeSelection(
      Array.isArray(saved) ? SUPPORTED_TESTS.filter((id) => saved.includes(id)) : [],
    );
  } catch {
    return new Set();
  }
}
