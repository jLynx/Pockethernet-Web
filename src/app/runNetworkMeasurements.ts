import {
  PACKET,
  measurementEthernetCommand,
  parseCdpLldpPacket,
  parseIpv4Packet,
  parseIpv6Packet,
  parseTrafficPacket,
  parseVlanPacket,
  trafficFilterCommand,
  type FieldsResult,
  type VlanTag,
  type TrafficPacketResult,
} from '@/pockethernetProtocol';
import type { PacketWaitOptions } from '@/device/packetInbox';
import type { MeasurementContext } from './runMeasurements';
import type { TestId } from './types';

export function deferredStart(): { promise: Promise<void>; start: () => void } {
  let start!: () => void;
  const promise = new Promise<void>((resolve) => {
    start = resolve;
  });
  return { promise, start };
}

/** APK states 50/52/60/70: one 10/100 setup, then simultaneous passive tests. */
export async function runNetworkMeasurements(
  context: MeasurementContext,
  configure: (
    command: ReturnType<typeof measurementEthernetCommand>,
    timeout: number,
  ) => Promise<void>,
  linkUp: (configure: () => Promise<void>) => Promise<void>,
  fail: (ids: TestId[], error: unknown) => void,
  expand: (id: TestId) => void,
): Promise<FieldsResult | null> {
  const { ble, selected, ipv4Settings, ipv6Mode, vlanSettings, toolSettings } = context;
  const needsIpv4 = (['ipv4', 'ping', 'extip'] as const).some((id) => selected.has(id));
  const networkIds = ['cdplldp', 'vlan', 'traffic', 'ipv4', 'ipv6', 'ping', 'extip'] as const;
  if (!networkIds.some((id) => selected.has(id))) return null;

  const command = measurementEthernetCommand({
    customMac: toolSettings.customMac === 'on' ? toolSettings.mac.trim() : '',
    outgoingVlanId: vlanSettings.tagging ? Number(vlanSettings.id) : 0,
    discovery: selected.has('cdplldp'),
    collectVlans: selected.has('vlan'),
    ipv4: needsIpv4,
    ipv4Settings,
    ipv6: selected.has('ipv6') ? ipv6Mode : null,
  });
  if (vlanSettings.tagging && Number(vlanSettings.id) === 0)
    throw new Error('Outgoing VLAN ID must be between 1 and 4094');

  const scope = new AbortController();
  const ready = deferredStart();
  const options: PacketWaitOptions = {
    signal: scope.signal,
    rejectNack: false,
    startAfter: ready.promise,
  };
  const jobs: Promise<void>[] = [];
  context.setPendingTests?.(
    new Set(networkIds.filter((id) => selected.has(id) && id !== 'ping' && id !== 'extip')),
  );
  const finish = (id: TestId): void =>
    context.setPendingTests?.((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  let ipv4: FieldsResult | null = null;
  // Register every listener before ETH_CONFIG: firmware may notify before its ACK.
  if (selected.has('cdplldp')) {
    context.setCdplldp(null);
    jobs.push(
      ble
        .collectFor(PACKET.ETH_FILTER_MATCH, context.discoveryTimeout ?? 30000, options)
        .then((packets) => {
          const discoveries = packets.flatMap((packet) => {
            try {
              return [parseCdpLldpPacket(packet.payload)];
            } catch {
              return [];
            } // The same filter channel also carries ordinary traffic.
          });
          context.setCdplldp(
            discoveries[discoveries.length - 1] ?? {
              status: 'not_OK',
              summary: 'No CDP/LLDP advertisement received',
              fields: {},
            },
          );
          expand('cdplldp');
        })
        .finally(() => finish('cdplldp')),
    );
  }
  if (selected.has('vlan')) {
    context.setVlan(null);
    jobs.push(
      ble
        .collectFor(PACKET.VLAN_COLLECT, 30000, options)
        .then((packets) => {
          const tags = new Map<string, VlanTag>();
          for (const packet of packets)
            for (const tag of parseVlanPacket(packet.payload))
              tags.set(`${tag.id}:${tag.priority}:${tag.dei}`, tag);
          const detected = [...tags.values()].sort(
            (a, b) => a.id - b.id || a.priority - b.priority,
          );
          context.setVlan(
            detected.length
              ? {
                  status: 'OK',
                  summary: `${detected.length} VLAN ID${detected.length === 1 ? '' : 's'} detected`,
                  tags: detected,
                }
              : { status: 'not_OK', summary: 'No VLAN tags received', tags: [] },
          );
          expand('vlan');
        })
        .finally(() => finish('vlan')),
    );
  }
  if (selected.has('traffic')) {
    context.setTraffic(null);
    jobs.push(
      ble
        .collectFor(PACKET.ETH_FILTER_MATCH, 30000, options)
        .then((packets) => {
          const frames = new Map<string, TrafficPacketResult>();
          for (const packet of packets) {
            const frame = parseTrafficPacket(packet.payload);
            frames.set(`${frame.source}:${frame.destination}:${frame.vlanId}`, frame);
          }
          const detected = [...frames.values()];
          context.setTraffic(
            detected.length
              ? {
                  status: 'OK',
                  summary: `${detected.length} packet${detected.length === 1 ? '' : 's'} received`,
                  packets: detected,
                }
              : { status: 'not_OK', summary: 'No packets received', packets: [] },
          );
          expand('traffic');
        })
        .finally(() => finish('traffic')),
    );
  }
  if (needsIpv4) {
    context.setIpv4(null);
    if (ipv4Settings.mode === 'dhcp') {
      jobs.push(
        ble
          .waitFor(PACKET.DHCPV4_ACK, 48000, options)
          .then((packet) => {
            ipv4 = parseIpv4Packet(packet.payload);
            context.setIpv4(ipv4);
            expand('ipv4');
          })
          .catch((error: unknown) => {
            if (scope.signal.aborted) throw error;
            context.setIpv4({
              status: 'not_OK',
              summary: 'No DHCPv4 response received',
              fields: {},
            });
            fail(['ipv4'], error);
          })
          .finally(() => finish('ipv4')),
      );
    }
  }
  if (selected.has('ipv6')) {
    context.setIpv6(null);
    const modes = ipv6Mode === 'both' ? (['slaac', 'dhcpv6'] as const) : [ipv6Mode];
    const waits = modes.map((mode) =>
      ble
        .waitFor(
          mode === 'slaac' ? PACKET.SLAAC_ACK : PACKET.DHCPV6_ACK,
          mode === 'slaac' ? 30000 : 48000,
          options,
        )
        .then((packet) => parseIpv6Packet(packet.payload, mode)),
    );
    jobs.push(
      Promise.allSettled(waits)
        .then((outcomes) => {
          if (scope.signal.aborted) return;
          const results = outcomes.flatMap((outcome) =>
            outcome.status === 'fulfilled' ? [outcome.value] : [],
          );
          const missed = outcomes.flatMap((outcome, index) =>
            outcome.status === 'rejected' ? [modes[index] === 'slaac' ? 'SLAAC' : 'DHCPv6'] : [],
          );
          context.setIpv6({
            status: missed.length ? 'not_OK' : 'OK',
            summary: [
              ...results.map((result) => result.summary),
              ...missed.map((mode) => `No ${mode} response received`),
            ].join(' / '),
            results,
          });
          const rejection = outcomes.find((outcome) => outcome.status === 'rejected');
          if (rejection?.status === 'rejected') fail(['ipv6'], rejection.reason);
          expand('ipv6');
        })
        .finally(() => finish('ipv6')),
    );
  }
  // All jobs have rejection handlers before we await startup or a different protocol.
  const completed = Promise.all(
    jobs.map((job) =>
      job.catch((error: unknown) => {
        if (!scope.signal.aborted) throw error;
      }),
    ),
  );
  void completed.catch(() => undefined);
  context.setActiveTest(networkIds.find((id) => selected.has(id)) ?? null);
  try {
    await linkUp(() => configure(command, 2000));
    if (selected.has('traffic')) await ble.request(trafficFilterCommand(), PACKET.ACK, 2000);
    if (needsIpv4 && ipv4Settings.mode === 'static') {
      ipv4 = {
        status: 'OK',
        summary: `IP: ${ipv4Settings.ip}`,
        fields: {
          'Your IP': ipv4Settings.ip,
          'Subnet Mask': ipv4Settings.netmask,
          Gateway: ipv4Settings.gateway,
          'DNS Servers': ipv4Settings.dns,
        },
      };
      context.setIpv4(ipv4);
      finish('ipv4');
      expand('ipv4');
    }
    ready.start(); // APK's 30/48 second async timers begin after link/filter setup.
    await completed;
    return ipv4;
  } catch (error) {
    fail(
      networkIds.filter((id) => selected.has(id)),
      error,
    );
    throw error;
  } finally {
    scope.abort();
    context.setPendingTests?.(new Set());
    await completed.catch(() => undefined);
  }
}
