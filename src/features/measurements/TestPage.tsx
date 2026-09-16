import type { ReactElement } from 'react';
import type {
  CdpLldpResult,
  FieldsResult,
  Ipv6Mode,
  LinkResult,
  PoeResult,
  TdrResult,
  WiremapResult,
} from '@/pockethernetProtocol';
import { tdrSummary } from '@/app/format';
import type {
  BerDisplayResult,
  BerSettings,
  DiscoveryFailure,
  Ipv4UiSettings,
  Ipv6DisplayResult,
  PingDisplayResult,
  StateSetter,
  TdrGraphResult,
  TestId,
  ToolSettings,
  TrafficDisplayResult,
  VlanDisplayResult,
  VlanSettings,
} from '@/app/types';
import { TestPanel } from '@/shared/layout/Layout';
import { BerResults } from './results/BerResults';
import { LinkResults, PoeResults } from './results/CableResults';
import {
  CdpLldpResults,
  ExternalIpResults,
  Ipv4Results,
  Ipv6Results,
  PingResults,
  TrafficResults,
  VlanResults,
} from './results/NetworkResults';
import { TdrGraphs, TdrResults } from './results/TdrResults';
import { WiremapDiagram } from './results/WiremapDiagram';
import { Button, PageHeader } from '@/shared/ui/UiPrimitives';

interface TestPageProps {
  selected: Set<TestId>;
  expanded: Set<TestId>;
  onToggle: (id: TestId) => void;
  onExpandedChange: StateSetter<Set<TestId>>;
  running: boolean;
  activeTest: TestId | null;
  toolSettings: ToolSettings;
  wiremap: WiremapResult | null;
  tdr: TdrResult | null;
  tdrGraph: TdrGraphResult | null;
  ber: BerDisplayResult | null;
  poe: PoeResult | null;
  link: LinkResult | null;
  cdplldp: CdpLldpResult | DiscoveryFailure | null;
  vlan: VlanDisplayResult | null;
  traffic: TrafficDisplayResult | null;
  ipv4: FieldsResult | null;
  ipv6: Ipv6DisplayResult | null;
  extip: FieldsResult | null;
  ping: PingDisplayResult | null;
  berSettings: BerSettings;
  onBerSettingsChange: StateSetter<BerSettings>;
  vlanSettings: VlanSettings;
  onVlanSettingsChange: StateSetter<VlanSettings>;
  ipv4Settings: Ipv4UiSettings;
  onIpv4SettingsChange: StateSetter<Ipv4UiSettings>;
  ipv6Mode: Ipv6Mode;
  onIpv6ModeChange: StateSetter<Ipv6Mode>;
  pingTargets: string[];
  onPingTargetsChange: StateSetter<string[]>;
}

const TEST_HELP: Record<TestId, { description: string; note?: string }> = {
  wiremap: {
    description:
      'Connect the Pockethernet Wiremap Adapter to the far end of the cable run. The test checks every pin for correct wiring, opens, shorts, and crossed pairs.',
    note: 'Do not test against an Ethernet port; its termination can appear as short circuits.',
  },
  tdr: {
    description:
      'Connect Pockethernet to one end only. TDR estimates cable length and locates opens, shorts, or termination on each pair.',
    note: 'Disconnect active network equipment first. Its transmitted signals make TDR results invalid.',
  },
  'tdr-graph': {
    description:
      'Connect Pockethernet to one end only. Peaks show impedance changes along the cable; positive reflections suggest opens and negative reflections suggest shorts.',
    note: 'Values beyond about +/-20 can indicate a cable imperfection. Do not test an active port.',
  },
  ber: {
    description:
      'Attach the loopback adapter at the far end. Pockethernet links through the cable, sends data, and checks the returned packets for loss or CRC errors.',
    note: 'The manual specifies cable runs up to 50 m / 160 ft for this test.',
  },
  poe: {
    description:
      'Connect directly to the cable or port supplying power. The test detects active 802.3af/at/bt and passive PoE, then reports voltage, wiring mode, and available power class.',
  },
  link: {
    description:
      'Connect to the switch, router, or device under test. Pockethernet finds the highest advertised link speed and reports link capabilities and pair details.',
    note: 'The length shown here is only a rough estimate; use TDR for cable length and fault location.',
  },
  cdplldp: {
    description:
      'Pockethernet listens for CDP or LLDP announcements for up to 30 seconds and reports details such as switch name, physical port ID, and management address.',
  },
  vlan: {
    description:
      'Listen for up to 30 seconds to discover VLAN tags seen on the port. Enable outgoing tagging to place Pockethernet DHCP, Ping, and External IP traffic on a specific VLAN.',
  },
  traffic: {
    description:
      'Observe traffic visible to Pockethernet on the connected port. Use this to confirm that the port is carrying packets before deeper network tests.',
  },
  ipv4: {
    description:
      'Request IPv4 settings from the network or enter static settings for later network tests. A DHCP request can take up to 30 seconds.',
  },
  ipv6: {
    description:
      'Check whether IPv6 SLAAC or DHCPv6 configuration is available. Pockethernet waits up to 30 seconds for the router advertisements needed to configure IPv6.',
  },
  extip: {
    description:
      'Verify Internet access and retrieve the connection’s public IP, provider, autonomous system, and approximate location using ip-api.com.',
  },
  ping: {
    description:
      'Ping up to three IP addresses or host names. Results include the resolved address and average time from three pings.',
    note: 'With no targets entered, Pockethernet uses the DHCP server, gateway, and DNS server.',
  },
};

export function TestPage(props: TestPageProps): ReactElement {
  const { selected, expanded, onToggle, onExpandedChange, running, activeTest, toolSettings } =
    props;
  const panel = (
    id: TestId,
  ): {
    selected: boolean;
    expanded: boolean;
    testing: boolean;
    onToggle: () => void;
    onExpand: () => void;
  } => ({
    selected: selected.has(id),
    expanded: expanded.has(id),
    testing: activeTest === id,
    onToggle: () => {
      onToggle(id);
    },
    onExpand: () => {
      onExpandedChange((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
  });
  return (
    <main className="test-page">
      <PageHeader
        className="test-intro"
        eyebrow="Cable diagnostics"
        title="Choose your tests"
        description="Select one or more tests, connect your Pockethernet, then measure."
        action={
          <Button
            className="collapse-all-button"
            disabled={expanded.size === 0}
            onClick={() => onExpandedChange(new Set())}
            aria-label="Collapse all tests"
            title="Collapse all tests"
          >
            <span className="collapse-all-icon" aria-hidden="true" />
          </Button>
        }
      />
      <TestPanel
        id="wiremap"
        title="Wiremap"
        help={TEST_HELP.wiremap}
        {...panel('wiremap')}
        status={props.wiremap ? (props.wiremap.status === 'OK' ? 'ok' : 'error') : 'idle'}
        summary={props.wiremap?.summary ?? 'Not measured'}
      >
        <WiremapDiagram result={props.wiremap} tia={toolSettings.tia} />
      </TestPanel>
      <TestPanel
        id="tdr"
        title="TDR"
        help={TEST_HELP.tdr}
        {...panel('tdr')}
        status={props.tdr ? (props.tdr.status === 'OK' ? 'ok' : 'error') : 'idle'}
        summary={props.tdr ? tdrSummary(props.tdr, toolSettings.units) : 'Not measured'}
      >
        <TdrResults result={props.tdr} units={toolSettings.units} tia={toolSettings.tia} />
      </TestPanel>
      <TestPanel
        id="tdr-graph"
        title="TDR Graph"
        help={TEST_HELP['tdr-graph']}
        {...panel('tdr-graph')}
        status={props.tdrGraph ? 'ok' : 'idle'}
        summary={props.tdrGraph ? 'Impedance & crosstalk' : 'Not measured'}
      >
        <TdrGraphs result={props.tdrGraph} units={toolSettings.units} tia={toolSettings.tia} />
      </TestPanel>
      <TestPanel
        id="ber"
        title="Error rate"
        help={TEST_HELP.ber}
        {...panel('ber')}
        status={props.ber ? 'ok' : 'idle'}
        summary={props.ber?.summary ?? 'Not measured'}
      >
        <BerResults
          result={props.ber}
          settings={props.berSettings}
          onSettingsChange={props.onBerSettingsChange}
          disabled={running}
        />
      </TestPanel>
      <TestPanel
        id="poe"
        title="PoE"
        help={TEST_HELP.poe}
        {...panel('poe')}
        status={props.poe ? (props.poe.status === 'OK' ? 'ok' : 'error') : 'idle'}
        summary={props.poe?.summary ?? 'Not measured'}
      >
        <PoeResults result={props.poe} tia={toolSettings.tia} />
      </TestPanel>
      <TestPanel
        id="link"
        title="Link"
        help={TEST_HELP.link}
        {...panel('link')}
        status={props.link ? (props.link.status === 'OK' ? 'ok' : 'error') : 'idle'}
        summary={props.link?.summary ?? 'Not measured'}
      >
        <LinkResults result={props.link} tia={toolSettings.tia} />
      </TestPanel>
      <TestPanel
        id="cdplldp"
        title="CDP/LLDP"
        help={TEST_HELP.cdplldp}
        {...panel('cdplldp')}
        status={props.cdplldp ? (props.cdplldp.status === 'not_OK' ? 'error' : 'ok') : 'idle'}
        summary={props.cdplldp?.summary ?? 'Not measured'}
      >
        <CdpLldpResults result={props.cdplldp} />
      </TestPanel>
      <TestPanel
        id="vlan"
        title="VLAN"
        help={TEST_HELP.vlan}
        {...panel('vlan')}
        status={props.vlan ? (props.vlan.status === 'OK' ? 'ok' : 'error') : 'idle'}
        summary={props.vlan?.summary ?? 'Not measured'}
      >
        <VlanResults
          result={props.vlan}
          settings={props.vlanSettings}
          onSettingsChange={props.onVlanSettingsChange}
          disabled={running}
        />
      </TestPanel>
      <TestPanel
        id="traffic"
        title="Traffic"
        help={TEST_HELP.traffic}
        {...panel('traffic')}
        status={props.traffic ? (props.traffic.status === 'OK' ? 'ok' : 'error') : 'idle'}
        summary={props.traffic?.summary ?? 'Not measured'}
      >
        <TrafficResults result={props.traffic} />
      </TestPanel>
      <TestPanel
        id="ipv4"
        title="IPv4"
        help={TEST_HELP.ipv4}
        {...panel('ipv4')}
        status={props.ipv4 ? (props.ipv4.status === 'OK' ? 'ok' : 'error') : 'idle'}
        summary={props.ipv4?.summary ?? 'Not measured'}
      >
        <Ipv4Results
          result={props.ipv4}
          settings={props.ipv4Settings}
          onSettingsChange={props.onIpv4SettingsChange}
          disabled={running}
        />
      </TestPanel>
      <TestPanel
        id="ipv6"
        title="IPv6"
        help={TEST_HELP.ipv6}
        {...panel('ipv6')}
        status={props.ipv6 ? (props.ipv6.status === 'OK' ? 'ok' : 'error') : 'idle'}
        summary={props.ipv6?.summary ?? 'Not measured'}
      >
        <Ipv6Results
          result={props.ipv6}
          mode={props.ipv6Mode}
          onModeChange={props.onIpv6ModeChange}
          disabled={running}
        />
      </TestPanel>
      <TestPanel
        id="extip"
        title="External IP"
        help={TEST_HELP.extip}
        {...panel('extip')}
        status={props.extip ? (props.extip.status === 'OK' ? 'ok' : 'error') : 'idle'}
        summary={props.extip?.summary ?? 'Not measured'}
      >
        <ExternalIpResults result={props.extip} />
      </TestPanel>
      <TestPanel
        id="ping"
        title="Ping"
        help={TEST_HELP.ping}
        {...panel('ping')}
        status={props.ping ? (props.ping.status === 'OK' ? 'ok' : 'error') : 'idle'}
        summary={props.ping?.summary ?? 'Not measured'}
      >
        <PingResults
          result={props.ping}
          targets={props.pingTargets}
          onTargetsChange={props.onPingTargetsChange}
          disabled={running}
        />
      </TestPanel>
    </main>
  );
}
