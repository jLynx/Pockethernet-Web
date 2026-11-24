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
  NetworkDiscoveryResult,
  NeighborResult,
  PingDisplayResult,
  StateSetter,
  TdrGraphResult,
  TestId,
  ToolSettings,
  TrafficDisplayResult,
  UnavailableTests,
  VlanDisplayResult,
} from '@/app/types';
import { TestPanel } from '@/shared/layout/Layout';
import { BerResults } from './results/BerResults';
import { NetworkDiscoveryResults } from './results/NetworkDiscoveryResults';
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
import type { useTestConfiguration } from '@/app/useTestConfiguration';
import { MeasurementControls } from './MeasurementControls';
import { Button } from '@/shared/ui/UiPrimitives';
import { PageLayout } from '@/shared/layout/PageLayout';
import { discoveryLabel } from '@/app/measurementSettings';

interface TestPageProps {
  batch?: boolean;
  configuration?: ReturnType<typeof useTestConfiguration>;
  firmwareVersion?: number;
  disabled?: boolean;
  unavailableTests?: UnavailableTests;
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
  networkDiscovery?: NetworkDiscoveryResult | null;
  cdplldp: CdpLldpResult | DiscoveryFailure | null;
  cdp?: NeighborResult | null;
  lldp?: NeighborResult | null;
  vlan: VlanDisplayResult | null;
  traffic: TrafficDisplayResult | null;
  ipv4: FieldsResult | null;
  ipv6: Ipv6DisplayResult | null;
  extip: FieldsResult | null;
  ping: PingDisplayResult | null;
  children?: ReactNode;
  onOpenConfigure?: () => void;
  workflowSelector?: ReactNode;
}

export function TestPage(props: TestPageProps): ReactElement {
  const { selected, expanded, onExpandedChange, activeTest, toolSettings, batch = true } = props;
  const unavailable = props.unavailableTests ?? {};
  const selectionDisabled = props.disabled ?? props.running;
  const discoveryMode = props.configuration?.measurementSettings.discoveryMode ?? 'active';
  const visible = (id: TestId): boolean => !batch || selected.has(id);
  const controls = (id: TestId): ReactNode =>
    !batch && props.configuration && !unavailable[id] ? (
      <MeasurementControls
        id={id}
        configuration={props.configuration}
        firmwareVersion={props.firmwareVersion}
        disabled={props.disabled ?? props.running}
      />
    ) : null;
  const panel = (
    id: TestId,
  ): {
    selected: boolean;
    selectionDisabled: boolean;
    expanded: boolean;
    testing: boolean;
    failure?: string;
    onToggle: () => void;
    onExpand: () => void;
  } => ({
    selected: selected.has(id) && !unavailable[id],
    selectionDisabled: selectionDisabled || Boolean(unavailable[id]),
    expanded: expanded.has(id),
    testing: props.pendingTests ? props.pendingTests.has(id) : activeTest === id,
    failure: unavailable[id] ? undefined : props.failures?.[id],
    onToggle: () => {
      if (!batch) props.onToggle(id);
      else props.onOpenConfigure?.();
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
    <PageLayout
      className="test-page"
      contentLayout="grid"
      eyebrow="Cable diagnostics"
      title={batch ? 'Test cable' : 'Choose your tests'}
      description={
        batch
          ? 'Run your configured tests, review the results, then save and move to the next cable.'
          : 'Select one or more tests, adjust their controls, then measure. Save the latest run from Reports.'
      }
      action={
        <div className="batch-save-actions">
          {batch && <Button onClick={props.onOpenConfigure}>Choose tests</Button>}
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
      headerChildren={props.workflowSelector}
    >
      {props.children}
      {batch && selected.size === 0 && (
        <p className="batch-empty">
          Choose the tests to run in Configure, then connect Pockethernet.
        </p>
      )}
      {!batch && <h2 className="test-group-heading">Cable tests</h2>}
      {visible('wiremap') && (
        <TestPanel
          selectable={!batch}
          id="wiremap"
          title="Wiremap"
          help={TEST_HELP.wiremap}
          {...panel('wiremap')}
          status={props.wiremap ? (props.wiremap.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.wiremap?.summary ?? 'Not measured'}
        >
          <WiremapDiagram
            pinOrder={toolSettings.wiremapPinOrder}
            result={props.wiremap}
            tia={toolSettings.tia}
            showShield={toolSettings.shieldTest !== false}
          />
        </TestPanel>
      )}
      {visible('tdr') && (
        <TestPanel
          selectable={!batch}
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
      {visible('tdr-graph') && (
        <TestPanel
          selectable={!batch}
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
      {visible('ber') && (
        <TestPanel
          selectable={!batch}
          id="ber"
          title="Error rate"
          help={TEST_HELP.ber}
          {...panel('ber')}
          status={props.ber ? 'ok' : 'idle'}
          summary={
            unavailable.ber ??
            (props.ber
              ? `Error rate: ${formatScalar(props.ber.errorRate, toolSettings.decimalSeparator)}`
              : 'Not measured')
          }
        >
          {controls('ber')}
          <BerResults result={props.ber} />
        </TestPanel>
      )}
      {!batch && <h2 className="test-group-heading test-group-heading-network">Network tests</h2>}
      {visible('poe') && (
        <TestPanel
          selectable={!batch}
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
      {visible('link') && (
        <TestPanel
          selectable={!batch}
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
      {visible('network-discovery') && (
        <TestPanel
          selectable={!batch}
          id="network-discovery"
          title={discoveryLabel(selected, discoveryMode)}
          help={TEST_HELP['network-discovery']}
          {...panel('network-discovery')}
          status={
            props.networkDiscovery
              ? props.networkDiscovery.status === 'OK'
                ? 'ok'
                : 'error'
              : 'idle'
          }
          summary={
            unavailable['network-discovery'] ??
            props.networkDiscovery?.summary ??
            (discoveryMode === 'auto'
              ? selected.has('ipv4')
                ? 'Turn off IPv4 to monitor only'
                : 'Turn on IPv4 for discovery'
              : 'Not measured')
          }
        >
          {controls('network-discovery')}
          <NetworkDiscoveryResults result={props.networkDiscovery} />
        </TestPanel>
      )}
      {selected.has('cdplldp') && (
        <TestPanel
          selectable={!batch}
          id="cdplldp"
          title="CDP/LLDP"
          help={TEST_HELP.cdplldp}
          {...panel('cdplldp')}
          status={props.cdplldp ? (props.cdplldp.status === 'not_OK' ? 'error' : 'ok') : 'idle'}
          summary={props.cdplldp?.summary ?? 'Not measured'}
        >
          {controls('cdplldp')}
          <CdpLldpResults result={props.cdplldp} />
        </TestPanel>
      )}
      {(['cdp', 'lldp'] as const).filter(visible).map((id) => {
        const result = props[id];
        return (
          <TestPanel
            key={id}
            selectable={!batch}
            id={id}
            title={id.toUpperCase()}
            help={TEST_HELP[id]}
            {...panel(id)}
            status={result ? (result.status === 'OK' ? 'ok' : 'error') : 'idle'}
            summary={result?.summary ?? 'Not measured'}
          >
            {controls(id)}
            {(result?.announcements ?? [result]).map((announcement, index) => (
              <CdpLldpResults key={index} result={announcement ?? null} />
            ))}
          </TestPanel>
        );
      })}
      {visible('vlan') && (
        <TestPanel
          selectable={!batch}
          id="vlan"
          title="VLAN"
          help={TEST_HELP.vlan}
          {...panel('vlan')}
          status={props.vlan ? (props.vlan.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.vlan?.summary ?? 'Not measured'}
        >
          {controls('vlan')}
          <VlanResults result={props.vlan} />
        </TestPanel>
      )}
      {visible('traffic') && (
        <TestPanel
          selectable={!batch}
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
      {visible('ipv4') && (
        <TestPanel
          selectable={!batch}
          id="ipv4"
          title="IPv4"
          help={TEST_HELP.ipv4}
          {...panel('ipv4')}
          status={props.ipv4 ? (props.ipv4.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.ipv4?.summary ?? 'Not measured'}
        >
          {controls('ipv4')}
          <Ipv4Results result={props.ipv4} />
        </TestPanel>
      )}
      {visible('ipv6') && (
        <TestPanel
          selectable={!batch}
          id="ipv6"
          title="IPv6"
          help={TEST_HELP.ipv6}
          {...panel('ipv6')}
          status={props.ipv6 ? (props.ipv6.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.ipv6?.summary ?? 'Not measured'}
        >
          {controls('ipv6')}
          <Ipv6Results result={props.ipv6} />
        </TestPanel>
      )}
      {visible('extip') && (
        <TestPanel
          selectable={!batch}
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
      {visible('ping') && (
        <TestPanel
          selectable={!batch}
          id="ping"
          title="Ping"
          help={TEST_HELP.ping}
          {...panel('ping')}
          status={props.ping ? (props.ping.status === 'OK' ? 'ok' : 'error') : 'idle'}
          summary={props.ping?.summary ?? 'Not measured'}
        >
          {controls('ping')}
          <PingResults result={props.ping} />
        </TestPanel>
      )}
    </PageLayout>
  );
}
