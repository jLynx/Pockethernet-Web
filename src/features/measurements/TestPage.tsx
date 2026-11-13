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
import type { useTestConfiguration } from '@/app/useTestConfiguration';
import { MeasurementControls } from './MeasurementControls';
import { Button } from '@/shared/ui/UiPrimitives';
import { PageLayout } from '@/shared/layout/PageLayout';

interface TestPageProps {
  batch?: boolean;
  configuration?: ReturnType<typeof useTestConfiguration>;
  disabled?: boolean;
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
  onOpenConfigure?: () => void;
  workflowSelector?: ReactNode;
}

export function TestPage(props: TestPageProps): ReactElement {
  const { selected, expanded, onExpandedChange, activeTest, toolSettings, batch = true } = props;
  const visible = (id: TestId): boolean => !batch || selected.has(id);
  const controls = (id: TestId): ReactNode =>
    !batch && props.configuration ? (
      <MeasurementControls
        id={id}
        configuration={props.configuration}
        disabled={props.disabled ?? props.running}
      />
    ) : null;
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
      {visible('wiremap') && (
        <TestPanel
          selectable={!batch}
          selectionDisabled={props.disabled ?? props.running}
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
      {visible('tdr') && (
        <TestPanel
          selectable={!batch}
          selectionDisabled={props.disabled ?? props.running}
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
          selectionDisabled={props.disabled ?? props.running}
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
          selectionDisabled={props.disabled ?? props.running}
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
          {controls('ber')}
          <BerResults result={props.ber} />
        </TestPanel>
      )}
      {visible('poe') && (
        <TestPanel
          selectable={!batch}
          selectionDisabled={props.disabled ?? props.running}
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
          selectionDisabled={props.disabled ?? props.running}
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
      {visible('cdplldp') && (
        <TestPanel
          selectable={!batch}
          selectionDisabled={props.disabled ?? props.running}
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
      {visible('vlan') && (
        <TestPanel
          selectable={!batch}
          selectionDisabled={props.disabled ?? props.running}
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
          selectionDisabled={props.disabled ?? props.running}
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
          selectionDisabled={props.disabled ?? props.running}
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
          selectionDisabled={props.disabled ?? props.running}
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
          selectionDisabled={props.disabled ?? props.running}
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
          selectionDisabled={props.disabled ?? props.running}
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
