import { discoveryMethods, type DiscoveryHost } from '@/protocol/networkDiscovery';
import type { NetworkDiscoveryResult } from './types';

export function discoveryHostName(host: DiscoveryHost): string | undefined {
  return (
    host.identity.Hostname ??
    host.identity['Reverse DNS'] ??
    host.identity['NetBIOS name'] ??
    Object.values(host.devices)
      .map((device) => device.Name)
      .find((name): name is string => typeof name === 'string')
  );
}

export function discoveryHostFields(host: DiscoveryHost): [string, string | number][] {
  const fields: [string, string | number][] = Object.entries({
    ...(host.mac ? { MAC: host.mac } : {}),
    ...(host.vendor ? { Vendor: host.vendor } : {}),
    ...host.identity,
    ...(host.services.length ? { Services: host.services.join(', ') } : {}),
    ...(host.methods ? { 'Seen via': discoveryMethods(host.methods).join(', ') } : {}),
  });
  for (const [protocol, values] of Object.entries(host.devices)) {
    fields.push([
      protocol,
      Object.entries(values)
        .map(([key, value]) => `${key} ${value}`)
        .join(', ') || 'Detected',
    ]);
  }
  return fields;
}

export function discoveryNotes(result: NetworkDiscoveryResult): string[] {
  const notes: string[] = [];
  if (result.passiveFallback) notes.push('IPv4 address unavailable. Passive observations shown.');
  if (result.completion?.rxSaturated)
    notes.push('The receive buffer filled. Results may be incomplete.');
  if (result.completion?.txLost)
    notes.push('The tester reported lost packets. Results may be incomplete.');
  if (result.malformedPackets)
    notes.push(`Could not read ${result.malformedPackets} discovery packet(s).`);
  return notes;
}

const IGMP_OBSERVATION_TYPE = 7;
const IGMP_LISTEN_THRESHOLD_MS = 130_000;

export function igmpQuerierStatus(result: NetworkDiscoveryResult): string | undefined {
  if (result.observations.some(({ type }) => type === IGMP_OBSERVATION_TYPE)) return 'Detected';
  if (result.state === 'listening' || result.state === 'scanning') return undefined;
  return (result.listenMs ?? 0) >= IGMP_LISTEN_THRESHOLD_MS ? 'None observed' : 'Inconclusive';
}
