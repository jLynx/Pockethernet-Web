import type { PockethernetClient } from '@/device/usePockethernet';
import { DeviceRejectedError, DeviceTimeoutError } from '@/device/packetInbox';
import { PACKET } from '@/protocol/constants';
import { parseDiscoverySegment } from '@/protocol/discoverySegment';
import { lookupDiscoveryVendor } from '@/protocol/discoveryVendors';
import { firmwareSupports } from '@/protocol/firmwareFeatures';
import {
  discoveryAbortCommand,
  discoveryStartCommand,
  parseDiscoveryDone,
  parseDiscoveryHosts,
  parseDiscoveryProgress,
  type DiscoveryDone,
  type DiscoveryHost,
  type DiscoveryProgress,
  type SegmentObservation,
  DISCOVERY_PROBES,
} from '@/protocol/networkDiscovery';
import type { Packet } from '@/protocol/types';
import type { NetworkDiscoveryResult } from './types';

const REPLIES = [
  PACKET.DISCOVERY_HOST,
  PACKET.DISCOVERY_PROGRESS,
  PACKET.DISCOVERY_SEGMENT,
  PACKET.DISCOVERY_DONE,
];
const METHOD_TIMEOUT_MS = 3000;
let nextToken = 0;

export function mergeDiscoveryHost(
  previous: DiscoveryHost,
  incoming: DiscoveryHost,
): DiscoveryHost {
  const devices = { ...previous.devices };
  for (const [protocol, fields] of Object.entries(incoming.devices)) {
    devices[protocol] = { ...devices[protocol], ...fields };
  }
  const unknown = new Map(
    [...previous.unknown, ...incoming.unknown].map((entry) => [
      `${entry.type}:${entry.hex}`,
      entry,
    ]),
  );
  return {
    ip: incoming.ip === '0.0.0.0' ? previous.ip : incoming.ip,
    mac: incoming.mac ?? previous.mac,
    methods: previous.methods | incoming.methods,
    identity: { ...previous.identity, ...incoming.identity },
    services: [...new Set([...previous.services, ...incoming.services])],
    devices,
    unknown: [...unknown.values()],
  };
}

export async function runNetworkDiscovery(
  client: PockethernetClient,
  options: {
    active: boolean;
    passiveFallback: boolean;
    signal: AbortSignal;
    probeMask?: number;
    sendAbort?: (packet: Packet) => Promise<void>;
  },
  onProgress: (result: NetworkDiscoveryResult) => void,
): Promise<NetworkDiscoveryResult> {
  const { active, passiveFallback, signal, probeMask, sendAbort = client.send } = options;
  const token = nextToken++ & 255;
  const hosts = new Map<string, DiscoveryHost>();
  const observations = new Map<string, SegmentObservation>();
  let progress: DiscoveryProgress | undefined;
  let completion: DiscoveryDone | undefined;
  let listenMs: number | undefined;
  let malformedPackets = 0;
  let state: NetworkDiscoveryResult['state'] = 'scanning';
  const snapshot = (summary: string): NetworkDiscoveryResult => ({
    status: state === 'completed' || state === 'capped' || state === 'scanning' ? 'OK' : 'not_OK',
    summary,
    state,
    mode: active ? 'active' : 'passive',
    passiveFallback,
    hosts: [...hosts.values()],
    observations: [...observations.values()],
    listenMs,
    progress,
    completion,
    ...(malformedPackets ? { malformedPackets } : {}),
  });
  const recordHost = (incoming: DiscoveryHost): void => {
    const { ip, mac } = incoming;
    if (ip === '0.0.0.0' && !mac) return;
    const match = [...hosts].find(
      ([, existing]) =>
        (ip !== '0.0.0.0' &&
          ip === existing.ip &&
          (!mac || !existing.mac || mac === existing.mac)) ||
        (mac && mac === existing.mac && (ip === '0.0.0.0' || existing.ip === '0.0.0.0')),
    );
    const host = match ? mergeDiscoveryHost(match[1], incoming) : incoming;
    if (match) hosts.delete(match[0]);
    hosts.set(`${host.ip}/${host.mac ?? ''}`, host);
  };
  const accept = (packet: Packet): boolean => {
    if (packet.payload[0] !== token) return false;
    try {
      switch (packet.type) {
        case PACKET.DISCOVERY_HOST:
          for (const host of parseDiscoveryHosts(packet.payload)) recordHost(host);
          break;
        case PACKET.DISCOVERY_SEGMENT: {
          const segment = parseDiscoverySegment(packet.payload);
          listenMs = Math.max(listenMs ?? 0, segment.listenMs);
          for (const observation of segment.observations)
            observations.set(observation.key, observation);
          break;
        }
        case PACKET.DISCOVERY_PROGRESS:
          progress = parseDiscoveryProgress(packet.payload);
          onProgress(
            snapshot(
              progress.total
                ? `Scanning · ${progress.probed}/${progress.total} addresses checked`
                : `Scanning · ${Math.max(hosts.size, progress.hosts)} hosts found`,
            ),
          );
          break;
        case PACKET.DISCOVERY_DONE:
          completion = parseDiscoveryDone(packet.payload);
          progress = completion;
          return true;
      }
    } catch {
      malformedPackets++;
    }
    return false;
  };
  const scope = new AbortController();
  const cancel = () => scope.abort();
  if (signal.aborted) cancel();
  signal.addEventListener('abort', cancel, { once: true });
  const advanced = firmwareSupports(client.info?.espVersion, 'advancedDiscovery');
  const deviceProbes =
    probeMask === undefined ||
    DISCOVERY_PROBES.some(({ bit, group }) => group === 'device' && (probeMask & bit) !== 0);
  const vendorData = import('virtual:discovery-oui').then(
    (data) => data.default,
    () => ({}),
  );
  let scanStarted = false;
  try {
    const deadline = active
      ? advanced && deviceProbes
        ? 90_000
        : 40_000
      : METHOD_TIMEOUT_MS + 5000;
    // The first token-matching stream event is the reply to START, even if ACK is absent.
    const done = client.waitFor(REPLIES, deadline, { signal: scope.signal, accept });
    void done.catch(() => undefined);
    try {
      onProgress(
        snapshot(active ? 'Scanning the local IPv4 subnet' : 'Collecting segment results'),
      );
      if (scope.signal.aborted) await done;
      scanStarted = true;
      await client.send(
        discoveryStartCommand(token, active, client.info?.espVersion, METHOD_TIMEOUT_MS, probeMask),
      );
      await done;
      state = completion?.status ?? 'error';
    } catch (error) {
      if (signal.aborted) {
        state = 'aborted';
        if (scanStarted) await sendAbort(discoveryAbortCommand(token)).catch(() => undefined);
      } else if (error instanceof DeviceTimeoutError) {
        state = 'timed-out';
        // The firmware may flush the last segment packet when it processes ABORT.
        const grace = client.waitFor(REPLIES, 3000, {
          signal: scope.signal,
          accept,
          rejectNack: false,
        });
        void grace.catch(() => undefined);
        await sendAbort(discoveryAbortCommand(token));
        await grace.catch((failure: unknown) => {
          if (!(failure instanceof DeviceTimeoutError)) throw failure;
        });
      } else if (error instanceof DeviceRejectedError) {
        state = 'error';
      } else {
        state = 'error';
        onProgress(snapshot('Scan interrupted. Partial results shown.'));
        throw error;
      }
    }
  } finally {
    scope.abort();
    signal.removeEventListener('abort', cancel);
  }
  const vendors = await vendorData;
  for (const [key, host] of hosts) {
    const deviceVendor = host.devices['Camera vendor']?.Vendor ?? host.devices.BACnet?.Vendor;
    const vendor =
      typeof deviceVendor === 'string'
        ? deviceVendor
        : host.mac
          ? lookupDiscoveryVendor(host.mac, vendors)
          : undefined;
    if (vendor) hosts.set(key, { ...host, vendor });
  }
  for (const [key, observation] of observations) {
    const mac = observation.fields.MAC ?? observation.fields['Sample MAC'];
    const vendor = typeof mac === 'string' ? lookupDiscoveryVendor(mac, vendors) : undefined;
    if (vendor)
      observations.set(key, { ...observation, fields: { ...observation.fields, Vendor: vendor } });
  }
  const counts = `${hosts.size} host${hosts.size === 1 ? '' : 's'}, ${observations.size} segment observation${observations.size === 1 ? '' : 's'}`;
  const summary = {
    completed: counts,
    capped: `${counts} · host limit reached`,
    aborted: `${counts} · scan stopped`,
    'timed-out': `${counts} · scan timed out`,
    error: `${counts} · scan failed${completion?.errorCode ? ` (code ${completion.errorCode})` : ''}`,
  }[state];
  return snapshot(summary);
}
