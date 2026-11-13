import type { Dispatch, SetStateAction } from 'react';
import {
  PACKET,
  berCommand,
  berEthernetCommand,
  diagnosticEthernetCommand,
  ethernetStopCommand,
  externalIpCommand,
  isBerLinkUp,
  linkCommand,
  parseBerPacket,
  parseExternalIpPacket,
  parseLinkPacket,
  parsePingPacket,
  parsePoePacket,
  parseTdrCrosstalkPacket,
  parseTdrPacket,
  parseWiremapPacket,
  pingCommand,
  poeCommand,
  tdrCommand,
  tdrCrosstalkCommand,
  wiremapCommand,
  type BerFrameSize,
  type BerResult,
  type CdpLldpResult,
  type FieldsResult,
  type LinkResult,
  type Packet,
  type PoeResult,
  type TdrResult,
  type WiremapResult,
} from '@/pockethernetProtocol';
import type { PockethernetClient } from '@/device/usePockethernet';
import { DeviceRejectedError, DeviceTimeoutError } from '@/device/packetInbox';
import { errorMessage } from './format';
import { deferredStart, runNetworkMeasurements } from './runNetworkMeasurements';
import { assessWiremap } from './wiremapAcceptance';
import type {
  BerDisplayResult,
  BerSettings,
  DiscoveryFailure,
  Ipv4UiSettings,
  Ipv6DisplayResult,
  MeasurementFailures,
  PingDisplayResult,
  TdrGraphResult,
  TestId,
  ToolSettings,
  TrafficDisplayResult,
  VlanDisplayResult,
  VlanSettings,
} from './types';

type Setter<T> = Dispatch<SetStateAction<T>>;

export interface MeasurementContext {
  ble: PockethernetClient;
  selected: Set<TestId>;
  setExpanded: Setter<Set<TestId>>;
  toolSettings: ToolSettings;
  berSettings: BerSettings;
  vlanSettings: VlanSettings;
  ipv4Settings: Ipv4UiSettings;
  ipv6Mode: 'slaac' | 'dhcpv6' | 'both';
  pingTargets: string[];
  discoveryTimeout?: 10000 | 30000 | 60000;
  setRunning: Setter<boolean>;
  setActiveTest: Setter<TestId | null>;
  setNotice: Setter<string>;
  setFailures?: Setter<MeasurementFailures>;
  setPendingTests?: Setter<Set<TestId>>;
  setWiremap: Setter<WiremapResult | null>;
  setTdr: Setter<TdrResult | null>;
  setTdrGraph: Setter<TdrGraphResult | null>;
  setBer: Setter<BerDisplayResult | null>;
  setPoe: Setter<PoeResult | null>;
  setLink: Setter<LinkResult | null>;
  setCdplldp: Setter<CdpLldpResult | DiscoveryFailure | null>;
  setVlan: Setter<VlanDisplayResult | null>;
  setTraffic: Setter<TrafficDisplayResult | null>;
  setIpv4: Setter<FieldsResult | null>;
  setIpv6: Setter<Ipv6DisplayResult | null>;
  setPing: Setter<PingDisplayResult | null>;
  setExtip: Setter<FieldsResult | null>;
}

/** APK pe_meas_pen numeric states: wiremap → TDR → graph → PoE → link/network → ping → external IP → BER. */
export async function runMeasurements(context: MeasurementContext): Promise<void> {
  const { ble, selected, toolSettings, berSettings } = context;
  const failures: MeasurementFailures = {};
  let ethernetStarted = false;
  let active: TestId | null = null;
  let aborted = false;
  const customMac = toolSettings.customMac === 'on' ? toolSettings.mac.trim() : '';
  const expand = (id: TestId): void => context.setExpanded((current) => new Set(current).add(id));
  const activate = (id: TestId): void => {
    active = id;
    context.setActiveTest(id);
    context.setPendingTests?.(new Set([id]));
  };
  const fail = (ids: TestId[], error: unknown): void => {
    for (const id of ids) failures[id] = errorMessage(error);
    context.setFailures?.({ ...failures });
  };
  // Only device timeouts/rejections are recoverable. A lost Bluetooth connection aborts.
  const attempt = async <T>(ids: TestId[], action: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof DeviceTimeoutError || error instanceof DeviceRejectedError))
        throw error;
      fail(ids, error);
      return undefined;
    }
  };
  const configure = async (command: Packet, timeout: number): Promise<void> => {
    ethernetStarted = true;
    await ble.request(command, PACKET.ACK, timeout);
  };
  // Link-down notifications are normal while the PHY negotiates. The APK waits for link UP.
  const linkUp = async (setup: () => Promise<void>): Promise<Packet> => {
    const scope = new AbortController();
    const configured = deferredStart();
    const reply = ble.waitFor(PACKET.PHY_LINKINFO, 10000, {
      signal: scope.signal,
      rejectNack: false,
      accept: (packet) => isBerLinkUp(packet.payload),
      startAfter: configured.promise,
    });
    void reply.catch(() => undefined);
    try {
      await setup();
      configured.start();
      return await reply;
    } finally {
      scope.abort();
    }
  };

  context.setFailures?.({});
  context.setNotice('');
  context.setRunning(true);
  // Clear selected results before any request, so an aborted run cannot display old results as new.
  if (selected.has('wiremap')) context.setWiremap(null);
  if (selected.has('tdr') || selected.has('tdr-graph')) {
    context.setTdr(null);
    context.setTdrGraph(null);
  }
  if (selected.has('poe')) context.setPoe(null);
  if (selected.has('link')) context.setLink(null);
  if (selected.has('cdplldp')) context.setCdplldp(null);
  if (selected.has('vlan')) context.setVlan(null);
  if (selected.has('traffic')) context.setTraffic(null);
  if (selected.has('ipv4')) context.setIpv4(null);
  if (selected.has('ipv6')) context.setIpv6(null);
  if (selected.has('ping')) context.setPing(null);
  if (selected.has('extip')) context.setExtip(null);
  if (selected.has('ber')) context.setBer(null);
  try {
    if (selected.has('wiremap')) {
      activate('wiremap');
      context.setWiremap(null);
      const response = await attempt(['wiremap'], () =>
        ble.request(wiremapCommand(), PACKET.WIREMAP, 5000),
      );
      if (response) {
        context.setWiremap(assessWiremap(parseWiremapPacket(response.payload), toolSettings));
        expand('wiremap');
      }
    }
    if (selected.has('tdr') || selected.has('tdr-graph')) {
      activate(selected.has('tdr') ? 'tdr' : 'tdr-graph');
      context.setTdr(null);
      // Always clear the graph: it must never combine a new same-pair trace with an old cross-pair trace.
      context.setTdrGraph(null);
      const ids = (['tdr', 'tdr-graph'] as const).filter((id) => selected.has(id));
      const prepared = await attempt(ids, async () => {
        await configure(diagnosticEthernetCommand(), 3000); // APK diagnostic setup uses the factory MAC.
        return true;
      });
      const response = prepared
        ? await attempt(ids, () => ble.request(tdrCommand(), PACKET.TDR_SAME, 5000))
        : undefined;
      if (response) {
        const tdr = parseTdrPacket(response.payload, Number(toolSettings.nvp));
        context.setTdr(tdr);
        if (selected.has('tdr')) expand('tdr');
        if (selected.has('tdr-graph')) {
          activate('tdr-graph');
          const cross = await attempt(['tdr-graph'], () =>
            ble.request(tdrCrosstalkCommand(), PACKET.TDR_CROSS, 8000),
          );
          if (cross) {
            const crosstalk = parseTdrCrosstalkPacket(cross.payload, tdr.nvp);
            context.setTdrGraph({
              impedance: tdr.pairs.map((pair) => pair.samples),
              crosstalk: crosstalk.traces,
              nvp: tdr.nvp,
            });
            expand('tdr-graph');
          }
        }
      }
    }
    if (selected.has('poe')) {
      activate('poe');
      context.setPoe(null);
      // The command builder's 10 s metadata is not the APK measurement FSM's 15 s deadline.
      const response = await attempt(['poe'], () => ble.request(poeCommand(), PACKET.POE, 15000));
      if (response) {
        context.setPoe(parsePoePacket(response.payload));
        expand('poe');
      }
    }
    if (selected.has('link')) {
      activate('link');
      context.setLink(null);
      // Link test does not use the custom MAC; only the subsequent network setup does.
      const response = await linkUp(() => configure(linkCommand(), 2000));
      context.setLink(parseLinkPacket(response.payload));
      expand('link');
    }
    const ipv4 = await runNetworkMeasurements(
      {
        ...context,
        setActiveTest: (update) => {
          active = typeof update === 'function' ? update(active) : update;
          context.setActiveTest(active);
        },
      },
      configure,
      async (setup) => {
        await linkUp(setup);
      },
      fail,
      expand,
    );
    const hasIpv4 = ipv4?.status === 'OK' && ipv4.fields['Your IP'] !== '0.0.0.0';
    if (selected.has('ping')) {
      activate('ping');
      context.setPing(null);
      const servers = [];
      if (!hasIpv4) fail(['ping'], new Error('No IPv4 address available to start Ping'));
      else {
        // Empty target slots use the DHCP server, gateway and first DNS server, as in the APK.
        const defaults = [
          ipv4.fields['Source IP'] ?? '',
          ipv4.fields.Gateway ?? '',
          ipv4.fields['DNS Servers'] ?? '',
        ];
        for (let index = 0; index < 3; index += 1) {
          const target = context.pingTargets[index]?.trim() || defaults[index].split(',')[0].trim();
          if (!target || target === '0.0.0.0') continue;
          const response = await attempt(['ping'], () =>
            ble.request(pingCommand(target), PACKET.PING, 5000),
          );
          servers.push(
            response
              ? parsePingPacket(response.payload)
              : { status: 'not_OK' as const, ip: target, time: 'Timeout' },
          );
        }
        if (!servers.length) fail(['ping'], new Error('No Ping targets available'));
      }
      const ok = servers.length > 0 && servers.every((server) => server.status === 'OK');
      context.setPing({
        status: ok ? 'OK' : 'not_OK',
        summary: ok ? 'Ping successful' : 'Ping error',
        servers,
      });
      expand('ping');
    }
    if (selected.has('extip')) {
      activate('extip');
      context.setExtip(null);
      if (!hasIpv4)
        fail(['extip'], new Error('No IPv4 address available to start External IP detection'));
      else {
        const response = await attempt(['extip'], () =>
          ble.request(externalIpCommand(), PACKET.HTTP_RESPONSE, 15000),
        );
        if (response) {
          context.setExtip(parseExternalIpPacket(response.payload));
          expand('extip');
        }
      }
    }
    if (selected.has('ber')) {
      activate('ber');
      context.setBer(null);
      await linkUp(() => configure(berEthernetCommand(berSettings.speed, customMac), 5000));
      if (!Number.isInteger(berSettings.total) || berSettings.total < 1)
        throw new Error('Invalid BER packet count');
      const batchCount = Math.ceil(berSettings.total / 10000);
      let result: BerResult | undefined;
      for (let batch = 0; batch < batchCount; batch += 1) {
        const frameSize: BerFrameSize =
          berSettings.frameSize === 'both' ? (batch % 2 ? 64 : 1500) : berSettings.frameSize;
        const packetCount = Math.min(10000, berSettings.total - batch * 10000);
        const response = await ble.request(
          berCommand(frameSize, berSettings.payloadMode, packetCount),
          [PACKET.BER, PACKET.PHY_LINKINFO],
          15000,
        );
        // APK treats a PHY notification during BER as test failure, preserving earlier batches.
        if (response.type === PACKET.PHY_LINKINFO)
          throw new Error('Error-rate test failed: Ethernet link changed');
        result = parseBerPacket(response.payload, result);
        context.setBer({ ...result, completedBatches: batch + 1, batchCount });
      }
      expand('ber');
    }
  } catch (error) {
    aborted = true;
    if (active) fail([active], error);
    context.setNotice(`Measurement failed: ${errorMessage(error)}`);
  } finally {
    // APK _abort_measurements also runs at normal completion and stops an interface it started.
    if (ethernetStarted) {
      try {
        await ble.request(ethernetStopCommand(), PACKET.ACK, 5000);
      } catch (error) {
        const cleanup = `Ethernet stop failed: ${errorMessage(error)}`;
        context.setNotice((current) => (current ? `${current}; ${cleanup}` : cleanup));
        aborted = true;
      }
    }
    if (!aborted && Object.keys(failures).length)
      context.setNotice(
        `Measurements completed with errors: ${Object.entries(failures)
          .map(([id, message]) => `${id}: ${message}`)
          .join('; ')}`,
      );
    context.setActiveTest(null);
    context.setPendingTests?.(new Set());
    context.setRunning(false);
  }
}
