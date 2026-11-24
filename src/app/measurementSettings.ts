import type { DiscoveryListenTime, DiscoveryMode, MeasurementSettings, TestId } from './types';
import { storedRecord } from './storage';
import { DEFAULT_DISCOVERY_PROBES } from '@/protocol/networkDiscovery';

export const DISCOVERY_LISTEN_TIMES: readonly DiscoveryListenTime[] = [
  10000, 15000, 30000, 60000, 130000, 300000,
];

export function discoveryIsActive(selected: ReadonlySet<TestId>, mode?: DiscoveryMode): boolean {
  if (mode === 'active') return true;
  if (mode === 'passive') return false;
  return selected.has('ipv4') || selected.has('ping') || selected.has('extip');
}

export function discoveryLabel(selected: ReadonlySet<TestId>, mode?: DiscoveryMode): string {
  return discoveryIsActive(selected, mode) ? 'Network Discovery' : 'Network Monitor';
}

export const DEFAULT_MEASUREMENT_SETTINGS: MeasurementSettings = {
  berSettings: { speed: 1000, frameSize: 'both', payloadMode: 'random', total: 100000 },
  vlanSettings: { tagging: false, id: '' },
  ipv4Settings: { mode: 'dhcp', ip: '', netmask: '', gateway: '', dns: '' },
  ipv6Mode: 'slaac',
  discoveryTimeout: 15000,
  discoveryMode: 'auto',
  discoveryProbeMask: DEFAULT_DISCOVERY_PROBES,
  cdpLldpFull: false,
};

export function loadMeasurementSettings(
  key = 'pockethernet.measurementSettings',
): MeasurementSettings {
  return normalizeMeasurementSettings(storedRecord(key));
}

export function normalizeMeasurementSettings(saved: Record<string, unknown>): MeasurementSettings {
  const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});
  const ber = record(saved.berSettings),
    vlan = record(saved.vlanSettings),
    ipv4 = record(saved.ipv4Settings);
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  const probeMask =
    typeof saved.discoveryProbeMask === 'number' &&
    Number.isSafeInteger(saved.discoveryProbeMask) &&
    saved.discoveryProbeMask >= 0 &&
    saved.discoveryProbeMask <= 0x7fffffff
      ? saved.discoveryProbeMask
      : undefined;
  return {
    berSettings: {
      speed: ber.speed === 10 || ber.speed === 100 ? ber.speed : 1000,
      frameSize: ber.frameSize === 64 || ber.frameSize === 1500 ? ber.frameSize : 'both',
      payloadMode: ber.payloadMode === '55' ? '55' : 'random',
      total: ber.total === 1000000 || ber.total === 10000000 ? ber.total : 100000,
    },
    vlanSettings: { tagging: vlan.tagging === true, id: text(vlan.id) },
    ipv4Settings: {
      mode: ipv4.mode === 'static' ? 'static' : 'dhcp',
      ip: text(ipv4.ip),
      netmask: text(ipv4.netmask),
      gateway: text(ipv4.gateway),
      dns: text(ipv4.dns),
      vendorClass: text(ipv4.vendorClass),
      vendorClassCustom: ipv4.vendorClassCustom === true,
    },
    ipv6Mode: saved.ipv6Mode === 'both' || saved.ipv6Mode === 'dhcpv6' ? saved.ipv6Mode : 'slaac',
    discoveryTimeout:
      DISCOVERY_LISTEN_TIMES.find((time) => time === saved.discoveryTimeout) ?? 15000,
    discoveryMode:
      saved.discoveryMode === 'passive' ||
      (saved.discoveryMode === 'active' && probeMask !== undefined)
        ? saved.discoveryMode
        : 'auto',
    discoveryProbeMask: probeMask ?? DEFAULT_DISCOVERY_PROBES,
    cdpLldpFull: saved.cdpLldpFull === true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
