import type { MeasurementSettings } from './types';
import { storedRecord } from './storage';

export const DEFAULT_MEASUREMENT_SETTINGS: MeasurementSettings = {
  berSettings: { speed: 1000, frameSize: 'both', payloadMode: 'random', total: 100000 },
  vlanSettings: { tagging: false, id: '' },
  ipv4Settings: { mode: 'dhcp', ip: '', netmask: '', gateway: '', dns: '' },
  ipv6Mode: 'slaac',
  discoveryTimeout: 30000,
};

export function loadMeasurementSettings(): MeasurementSettings {
  const saved = storedRecord('pockethernet.measurementSettings');
  const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});
  const ber = record(saved.berSettings),
    vlan = record(saved.vlanSettings),
    ipv4 = record(saved.ipv4Settings);
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
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
    },
    ipv6Mode: saved.ipv6Mode === 'both' || saved.ipv6Mode === 'dhcpv6' ? saved.ipv6Mode : 'slaac',
    discoveryTimeout:
      saved.discoveryTimeout === 10000 || saved.discoveryTimeout === 60000
        ? saved.discoveryTimeout
        : 30000,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
