import type { ReactElement, ReactNode } from 'react';
import type {
  CdpLldpResult,
  FieldsResult,
  LinkResult,
  PoeResult,
  TdrResult,
  WiremapResult,
} from '@/pockethernetProtocol';
import { tdrSummary } from '@/app/format';
import { formatScalar } from '@/app/numberFormat';
import type {
  BerDisplayResult,
  DiscoveryFailure,
  Ipv6DisplayResult,
  MeasurementFailures,
  PingDisplayResult,
  StateSetter,
  TdrGraphResult,
  TestId,
  ToolSettings,
  TrafficDisplayResult,
  VlanDisplayResult,
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
import { TEST_HELP } from './testHelp';
import { Button, PageHeader } from '@/shared/ui/UiPrimitives';

interface TestPageProps {
  selected: Set<TestId>;
  expanded: Set<TestId>;
  onToggle: (id: TestId) => void;
  onExpandedChange: StateSetter<Set<TestId>>;
  running: boolean;
  activeTest: TestId | null;
  failures?: MeasurementFailures;
  pendingTests?: Set<TestId>;
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
  children?: ReactNode;
  onOpenSettings?: () => void;
}

export function TestPage(props: TestPageProps): ReactElement {
  const { selected, expanded, onExpandedChange, activeTest, toolSettings } = props;
  const panel = (
    id: TestId,
  ): {
    selected: boolean;
    expanded: boolean;
    testing: boolean;
    failure?: string;
    onToggle: () => void;
    onExpand: () => void;
  } => ({
    selected: selected.has(id),
    expanded: expanded.has(id),
    testing: props.pendingTests ? props.pendingTests.has(id) : activeTest === id,
    failure: props.failures?.[id],
    onToggle: () => {
      props.onOpenSettings?.();
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
        title="Test cable"
        description="Run your configured tests, review the results, then save and move to the next cable."
        action={
          <div className="batch-save-actions">
            <Button onClick={props.onOpenSettings}>Choose tests</Button>
            <Button
              className="collapse-all-button"
              disabled={expanded.size === 0}
              onClick={() => onExpandedChange(new Set())}
              aria-label="Collapse all tests"
              title="Collapse all tests"
            >
              <span className="collapse-all-icon" aria-hidden="true" />
            </Button>
          </div>
        }
      />
      {props.children}
      {selected.size === 0 && (
        <p className="batch-empty">
          Choose the tests to run in Settings, then connect Pockethernet.
        </p>
      )}
      {selected.has('wiremap') && (
        <TestPanel
          selectable={false}
          id="wiremap"
          title="Wiremap"
          help={TEST_HELP.wiremap}
          {...panel('wiremap')}
          status={props.wiremap ? (props.wiremap.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.wiremap?.summary ?? 'Not measured'}
        >
          <WiremapDiagram
            result={props.wiremap}
            tia={toolSettings.tia}
            showShield={toolSettings.shieldTest !== false}
          />
        </TestPanel>
      )}
      {selected.has('tdr') && (
        <TestPanel
          selectable={false}
          id="tdr"
          title="TDR"
          help={TEST_HELP.tdr}
          {...panel('tdr')}
          status={props.tdr ? (props.tdr.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={
            props.tdr
              ? tdrSummary(props.tdr, toolSettings.units, toolSettings.decimalSeparator)
              : 'Not measured'
          }
        >
          <TdrResults result={props.tdr} units={toolSettings.units} tia={toolSettings.tia} />
        </TestPanel>
      )}
      {selected.has('tdr-graph') && (
        <TestPanel
          selectable={false}
          id="tdr-graph"
          title="TDR Graph"
          help={TEST_HELP['tdr-graph']}
          {...panel('tdr-graph')}
          status={props.tdrGraph ? 'ok' : 'idle'}
          summary={props.tdrGraph ? 'Impedance & crosstalk' : 'Not measured'}
        >
          <TdrGraphs result={props.tdrGraph} units={toolSettings.units} tia={toolSettings.tia} />
        </TestPanel>
      )}
      {selected.has('ber') && (
        <TestPanel
          selectable={false}
          id="ber"
          title="Error rate"
          help={TEST_HELP.ber}
          {...panel('ber')}
          status={props.ber ? 'ok' : 'idle'}
          summary={
            props.ber
              ? `Error rate: ${formatScalar(props.ber.errorRate, toolSettings.decimalSeparator)}`
              : 'Not measured'
          }
        >
          <BerResults result={props.ber} />
        </TestPanel>
      )}
      {selected.has('poe') && (
        <TestPanel
          selectable={false}
          id="poe"
          title="PoE"
          help={TEST_HELP.poe}
          {...panel('poe')}
          status={props.poe ? (props.poe.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.poe?.summary ?? 'Not measured'}
        >
          <PoeResults result={props.poe} tia={toolSettings.tia} />
        </TestPanel>
      )}
      {selected.has('link') && (
        <TestPanel
          selectable={false}
          id="link"
          title="Link"
          help={TEST_HELP.link}
          {...panel('link')}
          status={props.link ? (props.link.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.link?.summary ?? 'Not measured'}
        >
          <LinkResults result={props.link} tia={toolSettings.tia} />
        </TestPanel>
      )}
      {selected.has('cdplldp') && (
        <TestPanel
          selectable={false}
          id="cdplldp"
          title="CDP/LLDP"
          help={TEST_HELP.cdplldp}
          {...panel('cdplldp')}
          status={props.cdplldp ? (props.cdplldp.status === 'not_OK' ? 'error' : 'ok') : 'idle'}
          summary={props.cdplldp?.summary ?? 'Not measured'}
        >
          <CdpLldpResults result={props.cdplldp} />
        </TestPanel>
      )}
      {selected.has('vlan') && (
        <TestPanel
          selectable={false}
          id="vlan"
          title="VLAN"
          help={TEST_HELP.vlan}
          {...panel('vlan')}
          status={props.vlan ? (props.vlan.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.vlan?.summary ?? 'Not measured'}
        >
          <VlanResults result={props.vlan} />
        </TestPanel>
      )}
      {selected.has('traffic') && (
        <TestPanel
          selectable={false}
          id="traffic"
          title="Traffic"
          help={TEST_HELP.traffic}
          {...panel('traffic')}
          status={props.traffic ? (props.traffic.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.traffic?.summary ?? 'Not measured'}
        >
          <TrafficResults result={props.traffic} />
        </TestPanel>
      )}
      {selected.has('ipv4') && (
        <TestPanel
          selectable={false}
          id="ipv4"
          title="IPv4"
          help={TEST_HELP.ipv4}
          {...panel('ipv4')}
          status={props.ipv4 ? (props.ipv4.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.ipv4?.summary ?? 'Not measured'}
        >
          <Ipv4Results result={props.ipv4} />
        </TestPanel>
      )}
      {selected.has('ipv6') && (
        <TestPanel
          selectable={false}
          id="ipv6"
          title="IPv6"
          help={TEST_HELP.ipv6}
          {...panel('ipv6')}
          status={props.ipv6 ? (props.ipv6.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.ipv6?.summary ?? 'Not measured'}
        >
          <Ipv6Results result={props.ipv6} />
        </TestPanel>
      )}
      {selected.has('extip') && (
        <TestPanel
          selectable={false}
          id="extip"
          title="External IP"
          help={TEST_HELP.extip}
          {...panel('extip')}
          status={props.extip ? (props.extip.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.extip?.summary ?? 'Not measured'}
        >
          <ExternalIpResults result={props.extip} />
        </TestPanel>
      )}
      {selected.has('ping') && (
        <TestPanel
          selectable={false}
          id="ping"
          title="Ping"
          help={TEST_HELP.ping}
          {...panel('ping')}
          status={props.ping ? (props.ping.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.ping?.summary ?? 'Not measured'}
        >
          <PingResults result={props.ping} />
        </TestPanel>
      )}
    </main>
  );
}
