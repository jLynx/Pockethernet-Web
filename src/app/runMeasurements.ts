import type { Dispatch, SetStateAction } from 'react';
import {
  PACKET,
  berCommand,
  berEthernetCommand,
  cdpLldpCommand,
  diagnosticEthernetCommand,
  externalIpCommand,
  ipv4EthernetCommand,
  ipv6EthernetCommand,
  isBerLinkUp,
  linkCommand,
  parseBerPacket,
  parseCdpLldpPacket,
  parseExternalIpPacket,
  parseIpv4Packet,
  parseIpv6Packet,
  parseLinkPacket,
  parsePingPacket,
  parsePoePacket,
  parseTdrCrosstalkPacket,
  parseTdrPacket,
  parseTrafficPacket,
  parseVlanPacket,
  parseWiremapPacket,
  pingCommand,
  poeCommand,
  tdrCommand,
  tdrCrosstalkCommand,
  trafficEthernetCommand,
  trafficFilterCommand,
  vlanEthernetCommand,
  wiremapCommand,
  type BerFrameSize,
  type BerResult,
  type CdpLldpResult,
  type FieldsResult,
  type LinkResult,
  type PoeResult,
  type TdrResult,
  type TrafficPacketResult,
  type VlanTag,
  type WiremapResult,
} from '@/pockethernetProtocol';
import type { PockethernetClient } from '@/device/usePockethernet';
import { errorMessage } from './format';
import type {
  BerDisplayResult,
  BerSettings,
  DiscoveryFailure,
  Ipv4UiSettings,
  Ipv6DisplayResult,
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
  setRunning: Setter<boolean>;
  setActiveTest: Setter<TestId | null>;
  setNotice: Setter<string>;
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

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function runMeasurements(context: MeasurementContext): Promise<void> {
  const {
    ble,
    selected,
    setExpanded,
    toolSettings,
    berSettings,
    vlanSettings,
    ipv4Settings,
    ipv6Mode,
    pingTargets,
    setRunning,
    setActiveTest,
    setNotice,
    setWiremap,
    setTdr,
    setTdrGraph,
    setBer,
    setPoe,
    setLink,
    setCdplldp,
    setVlan,
    setTraffic,
    setIpv4,
    setIpv6,
    setPing,
    setExtip,
  } = context;
  const expand = (id: TestId): void => {
    setExpanded((current) => new Set(current).add(id));
  };
  setRunning(true);
  try {
    const customMac = toolSettings.customMac === 'on' ? toolSettings.mac.trim() : '';
    if (selected.has('wiremap')) {
      setActiveTest('wiremap');
      setWiremap(null);
      const response = await ble.request(wiremapCommand(), PACKET.WIREMAP, 5000);
      setWiremap(parseWiremapPacket(response.payload));
      expand('wiremap');
    }
    if (selected.has('poe')) {
      setActiveTest('poe');
      setPoe(null);
      const response = await ble.request(poeCommand(), PACKET.POE, 12000);
      setPoe(parsePoePacket(response.payload));
      expand('poe');
    }
    if (selected.has('link')) {
      setActiveTest('link');
      setLink(null);
      const linkWait = ble.waitFor(PACKET.PHY_LINKINFO, 12000);
      await ble.request(linkCommand(customMac), PACKET.ACK, 3000);
      setLink(parseLinkPacket((await linkWait).payload));
      expand('link');
    }
    if (selected.has('cdplldp')) {
      setActiveTest('cdplldp');
      setCdplldp(null);
      const linkWait = ble.waitFor(PACKET.PHY_LINKINFO, 12000);
      await ble.request(cdpLldpCommand(customMac), PACKET.ACK, 5000);
      await linkWait;
      try {
        const frame = await ble.waitFor(PACKET.ETH_FILTER_MATCH, 30000);
        setCdplldp(parseCdpLldpPacket(frame.payload));
      } catch (error) {
        if (!errorMessage(error).includes('did not respond')) throw error;
        setCdplldp({ status: 'not_OK', summary: 'No CDP/LLDP advertisement received', fields: {} });
      }
      expand('cdplldp');
    }
    if (selected.has('vlan')) {
      setActiveTest('vlan');
      setVlan(null);
      const outgoingVlanId = vlanSettings.tagging ? Number(vlanSettings.id) : 0;
      if (
        vlanSettings.tagging &&
        (!Number.isInteger(outgoingVlanId) || outgoingVlanId < 1 || outgoingVlanId > 4094)
      ) {
        throw new Error('Outgoing VLAN ID must be between 1 and 4094');
      }
      const linkWait = ble.waitFor(PACKET.PHY_LINKINFO, 12000);
      await ble.request(vlanEthernetCommand(outgoingVlanId, customMac), PACKET.ACK, 5000);
      await linkWait;
      const packets = await ble.collectFor(PACKET.VLAN_COLLECT, 30000);
      const tags = new Map<string, VlanTag>();
      packets
        .flatMap((packet) => parseVlanPacket(packet.payload))
        .forEach((tag) => tags.set(`${tag.id}:${tag.priority}:${tag.dei}`, tag));
      const detected = Array.from(tags.values()).sort(
        (first, second) => first.id - second.id || first.priority - second.priority,
      );
      setVlan(
        detected.length
          ? {
              status: 'OK',
              summary: `${detected.length} VLAN ID${detected.length === 1 ? '' : 's'} detected`,
              tags: detected,
            }
          : { status: 'not_OK', summary: 'No VLAN tags received', tags: [] },
      );
      expand('vlan');
    }
    if (selected.has('traffic')) {
      setActiveTest('traffic');
      setTraffic(null);
      const linkWait = ble.waitFor(PACKET.PHY_LINKINFO, 12000);
      await ble.request(trafficEthernetCommand(customMac), PACKET.ACK, 5000);
      await linkWait;
      await sleep(10000);
      const packetsWait = ble.collectFor(PACKET.ETH_FILTER_MATCH, 30000);
      await ble.send(trafficFilterCommand());
      await sleep(2000);
      const frames = new Map<string, TrafficPacketResult>();
      (await packetsWait).forEach((packet) => {
        const frame = parseTrafficPacket(packet.payload);
        frames.set(`${frame.source}:${frame.destination}:${frame.vlanId}`, frame);
      });
      const packets = Array.from(frames.values());
      setTraffic(
        packets.length
          ? {
              status: 'OK',
              summary: `${packets.length} packet${packets.length === 1 ? '' : 's'} received`,
              packets,
            }
          : { status: 'not_OK', summary: 'No packets received', packets: [] },
      );
      expand('traffic');
    }
    if (selected.has('ipv4')) {
      setActiveTest('ipv4');
      setIpv4(null);
      const dhcpWait = ipv4Settings.mode === 'dhcp' ? ble.waitFor(PACKET.DHCPV4_ACK, 48000) : null;
      await ble.request(
        ipv4EthernetCommand(ipv4Settings.mode, ipv4Settings, customMac),
        PACKET.ACK,
        5000,
      );
      const result: FieldsResult = dhcpWait
        ? parseIpv4Packet((await dhcpWait).payload)
        : {
            status: 'OK',
            summary: `IP: ${ipv4Settings.ip}`,
            fields: {
              'Your IP': ipv4Settings.ip,
              'Subnet Mask': ipv4Settings.netmask,
              Gateway: ipv4Settings.gateway,
              'DNS Servers': ipv4Settings.dns,
            },
          };
      setIpv4(result);
      expand('ipv4');
    }
    if (selected.has('ipv6')) {
      setActiveTest('ipv6');
      setIpv6(null);
      const slaacWait =
        ipv6Mode === 'slaac' || ipv6Mode === 'both' ? ble.waitFor(PACKET.SLAAC_ACK, 30000) : null;
      const dhcpv6Wait =
        ipv6Mode === 'dhcpv6' || ipv6Mode === 'both' ? ble.waitFor(PACKET.DHCPV6_ACK, 30000) : null;
      await ble.request(ipv6EthernetCommand(ipv6Mode, customMac), PACKET.ACK, 5000);
      try {
        const results = [];
        if (slaacWait) results.push(parseIpv6Packet((await slaacWait).payload, 'slaac'));
        if (dhcpv6Wait) results.push(parseIpv6Packet((await dhcpv6Wait).payload, 'dhcpv6'));
        setIpv6({
          status: 'OK',
          summary: results.map((result) => result.summary).join(' / '),
          results,
        });
      } catch (error) {
        if (!errorMessage(error).includes('did not respond')) throw error;
        setIpv6({ status: 'not_OK', summary: 'No IPv6 response received', results: [] });
      }
      expand('ipv6');
    }
    if (selected.has('ping')) {
      setActiveTest('ping');
      setPing(null);
      const targets = pingTargets.map((target) => target.trim()).filter(Boolean);
      if (!targets.length) throw new Error('Enter at least one Ping target');
      const servers = [];
      for (const target of targets) {
        const response = await ble.request(pingCommand(target), PACKET.PING, 5000);
        servers.push(parsePingPacket(response.payload));
      }
      const status = servers.every((server) => server.status === 'OK') ? 'OK' : 'not_OK';
      setPing({ status, summary: status === 'OK' ? 'Ping successful' : 'Ping error', servers });
      expand('ping');
    }
    if (selected.has('extip')) {
      setActiveTest('extip');
      setExtip(null);
      const response = await ble.request(externalIpCommand(), PACKET.HTTP_RESPONSE, 15000);
      setExtip(parseExternalIpPacket(response.payload));
      expand('extip');
    }
    if (selected.has('tdr') || selected.has('tdr-graph')) {
      setActiveTest(selected.has('tdr') ? 'tdr' : 'tdr-graph');
      setTdr(null);
      if (selected.has('tdr-graph')) setTdrGraph(null);
      await ble.request(diagnosticEthernetCommand(customMac), PACKET.ACK, 3000);
      const response = await ble.request(tdrCommand(), PACKET.TDR_SAME, 5000);
      const parsedTdr = parseTdrPacket(response.payload, Number(toolSettings.nvp));
      setTdr(parsedTdr);
      if (selected.has('tdr-graph')) {
        setActiveTest('tdr-graph');
        const crossResponse = await ble.request(tdrCrosstalkCommand(), PACKET.TDR_CROSS, 8000);
        const crosstalk = parseTdrCrosstalkPacket(crossResponse.payload, parsedTdr.nvp);
        setTdrGraph({
          impedance: parsedTdr.pairs.map((pair) => pair.samples),
          crosstalk: crosstalk.traces,
          nvp: parsedTdr.nvp,
        });
        expand('tdr-graph');
      } else expand('tdr');
    }
    if (selected.has('ber')) {
      setActiveTest('ber');
      setBer(null);
      const linkWait = ble.waitFor(PACKET.PHY_LINKINFO, 10000);
      await ble.request(berEthernetCommand(berSettings.speed, customMac), PACKET.ACK, 5000);
      if (!isBerLinkUp((await linkWait).payload))
        throw new Error('Ethernet link did not come up for the error-rate test');
      const batchCount = Math.ceil(berSettings.total / 10000);
      let result: BerResult | undefined;
      for (let batch = 0; batch < batchCount; batch += 1) {
        const frameSize: BerFrameSize =
          berSettings.frameSize === 'both' ? (batch % 2 ? 64 : 1500) : berSettings.frameSize;
        const packetCount = Math.min(10000, berSettings.total - batch * 10000);
        const response = await ble.request(
          berCommand(frameSize, berSettings.payloadMode, packetCount),
          PACKET.BER,
          15000,
        );
        result = parseBerPacket(response.payload, result);
        setBer({ ...result, completedBatches: batch + 1, batchCount });
      }
      expand('ber');
    }
  } catch (error) {
    setNotice(`Measurement failed: ${errorMessage(error)}`);
  } finally {
    setActiveTest(null);
    setRunning(false);
  }
}
