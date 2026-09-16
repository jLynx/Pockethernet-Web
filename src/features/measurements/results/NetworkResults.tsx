import type { ChangeEvent, ReactElement } from 'react';
import type { FieldsResult, Ipv6Mode } from '@/pockethernetProtocol';
import type {
  DiscoveryResult,
  Ipv4UiSettings,
  Ipv6DisplayResult,
  PingDisplayResult,
  StateSetter,
  TrafficDisplayResult,
  VlanDisplayResult,
  VlanSettings,
} from '@/app/types';
import {
  DataRow,
  EmptyState,
  SectionTitle,
  SelectField,
  TextField,
  ToggleSwitch,
} from '@/shared/ui/UiPrimitives';

export function CdpLldpResults({ result }: { result: DiscoveryResult | null }): ReactElement {
  if (!result)
    return (
      <EmptyState className="cdplldp-awaiting">
        Run a measurement to listen for CDP or LLDP advertisements
      </EmptyState>
    );
  if (result.status === 'not_OK')
    return (
      <EmptyState className="cdplldp-no-result" tone="error">
        {result.summary}
      </EmptyState>
    );
  const entries = Object.entries(result.fields).filter(([, value]) => value !== '');
  return (
    <div className="cdplldp-results">
      <SectionTitle className="cdplldp-section-title">
        {result.summary} <span>{result.protocol}</span>
      </SectionTitle>
      <DataRow className="cdplldp-row" label="Eth Src Addr" value={result.source} />
      {entries.map(([label, value]) => (
        <DataRow className="cdplldp-row" key={label} label={label} value={value} />
      ))}
    </div>
  );
}

interface VlanResultsProps {
  result: VlanDisplayResult | null;
  settings: VlanSettings;
  onSettingsChange: StateSetter<VlanSettings>;
  disabled: boolean;
}

export function VlanResults({
  result,
  settings,
  onSettingsChange,
  disabled,
}: VlanResultsProps): ReactElement {
  const updateTagging = (): void => {
    onSettingsChange((current) => ({ ...current, tagging: !current.tagging }));
  };
  const updateId = (event: ChangeEvent<HTMLInputElement>): void => {
    onSettingsChange((current) => ({
      ...current,
      id: event.target.value.replace(/\D/g, '').slice(0, 4),
    }));
  };
  const rows = result?.status === 'OK' ? result.tags : [];
  return (
    <div className="vlan-results">
      <div className="vlan-settings">
        <label>Outgoing VLAN tagging</label>
        <ToggleSwitch
          className="vlan-toggle"
          checked={settings.tagging}
          onChange={updateTagging}
          disabled={disabled}
          ariaLabel="Outgoing VLAN tagging"
        />
        <TextField
          className="vlan-id-label"
          label="Outgoing VLAN ID"
          inputMode="numeric"
          value={settings.id}
          onChange={updateId}
          disabled={disabled || !settings.tagging}
          placeholder="1-4094"
        />
      </div>
      <div className="vlan-header">
        <span>Incoming</span>
        <span>Detected VLAN IDs</span>
      </div>
      {rows.map((tag) => (
        <div className="vlan-row" key={`${tag.id}:${tag.priority}:${tag.dei}`}>
          <span />
          <strong>
            {tag.id}
            {tag.priority ? ` PRI: ${tag.priority}` : ''}
            {tag.dei ? ' DEI' : ''}
          </strong>
        </div>
      ))}
      {!result && (
        <EmptyState className="vlan-awaiting">
          Run a measurement to collect incoming VLAN tags
        </EmptyState>
      )}
      {result && result.status !== 'OK' && (
        <EmptyState className="vlan-no-result" tone="error">
          {result.summary}
        </EmptyState>
      )}
    </div>
  );
}

export function ExternalIpResults({ result }: { result: FieldsResult | null }): ReactElement {
  if (!result)
    return (
      <EmptyState className="extip-awaiting">
        Run a measurement to detect the public IP address
      </EmptyState>
    );
  if (result.status !== 'OK')
    return (
      <EmptyState className="extip-no-result" tone="error">
        {result.summary}
      </EmptyState>
    );
  return (
    <div className="extip-results">
      {Object.entries(result.fields).map(([label, value]) => (
        <DataRow className="extip-row" key={label} label={label} value={value || '---'} />
      ))}
    </div>
  );
}

export function TrafficResults({ result }: { result: TrafficDisplayResult | null }): ReactElement {
  if (!result)
    return (
      <EmptyState className="traffic-awaiting">
        Run a measurement to listen for Ethernet traffic
      </EmptyState>
    );
  if (result.status !== 'OK')
    return (
      <EmptyState className="traffic-no-result" tone="error">
        {result.summary}
      </EmptyState>
    );
  return (
    <div className="traffic-results">
      <div className="traffic-header">
        <span>Src Addr</span>
        <span>Dst Addr</span>
        <span>VLAN ID</span>
      </div>
      {result.packets.map((packet, index) => (
        <div
          className="traffic-row"
          key={`${packet.source}:${packet.destination}:${packet.vlanId}:${index}`}
        >
          <span>{packet.source}</span>
          <span>{packet.destination}</span>
          <strong>{packet.vlanId}</strong>
        </div>
      ))}
    </div>
  );
}

interface PingResultsProps {
  result: PingDisplayResult | null;
  targets: string[];
  onTargetsChange: StateSetter<string[]>;
  disabled: boolean;
}

export function PingResults({
  result,
  targets,
  onTargetsChange,
  disabled,
}: PingResultsProps): ReactElement {
  const updateTarget = (index: number, value: string): void => {
    onTargetsChange((current) =>
      current.map((target, targetIndex) => (targetIndex === index ? value.slice(0, 127) : target)),
    );
  };
  return (
    <div className="ping-results">
      {targets.map((target, index) => (
        <div className="ping-server" key={index}>
          <TextField
            label={`Server ${index}`}
            value={target}
            onChange={(event) => {
              updateTarget(index, event.target.value);
            }}
            disabled={disabled}
            placeholder="Enter IP/domain"
            maxLength={127}
          />
          <DataRow className="ping-row" label="IP" value={result?.servers[index]?.ip ?? ''} />
          <DataRow
            className="ping-row"
            label="Avg time"
            value={result?.servers[index]?.time ?? ''}
          />
        </div>
      ))}
    </div>
  );
}

interface Ipv4ResultsProps {
  result: FieldsResult | null;
  settings: Ipv4UiSettings;
  onSettingsChange: StateSetter<Ipv4UiSettings>;
  disabled: boolean;
}

export function Ipv4Results({
  result,
  settings,
  onSettingsChange,
  disabled,
}: Ipv4ResultsProps): ReactElement {
  const update = (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>): void => {
    const { name, value } = event.target;
    onSettingsChange((current) =>
      name === 'mode'
        ? { ...current, mode: value === 'static' ? 'static' : 'dhcp' }
        : name === 'ip' || name === 'netmask' || name === 'gateway' || name === 'dns'
          ? { ...current, [name]: value }
          : current,
    );
  };
  const labels: readonly (readonly [string, string])[] = [
    ['Your IP', 'Your IP'],
    ['Subnet Mask', 'Subnet Mask'],
    ['Gateway', 'Gateway'],
    ['DNS Servers', 'DNS'],
    ['Eth Src Addr', 'Eth Src Addr'],
    ['Source IP', 'IP Src Addr'],
    ['Next Server IP', 'Next server IP'],
    ['Relay IP', 'Relay IP'],
    ['Server ID', 'Server ID'],
    ['IP lease time', 'Lease time'],
    ['Renewal time', 'Renewal time'],
    ['Broadcast', 'Broadcast'],
    ['Filename', 'Filename'],
    ['Server name', 'Server name'],
    ['Other options', 'Other options'],
  ];
  const staticFields: readonly (readonly [Exclude<keyof Ipv4UiSettings, 'mode'>, string])[] = [
    ['ip', 'Static IP'],
    ['netmask', 'Netmask'],
    ['gateway', 'Gateway'],
    ['dns', 'DNS'],
  ];
  return (
    <div className="ipv4-results">
      <div className="ipv4-settings">
        <SelectField
          label="IPv4 mode"
          name="mode"
          value={settings.mode}
          onChange={update}
          disabled={disabled}
        >
          <option value="static">Static</option>
          <option value="dhcp">DHCPv4</option>
        </SelectField>
        {settings.mode === 'static' &&
          staticFields.map(([name, label]) => (
            <TextField
              key={name}
              label={label}
              name={name}
              value={settings[name]}
              onChange={update}
              disabled={disabled}
              placeholder="Enter IP"
            />
          ))}
      </div>
      {!result && (
        <EmptyState className="ipv4-awaiting">
          Run a measurement to obtain an IPv4 address
        </EmptyState>
      )}
      {result?.status !== 'OK' && result && (
        <EmptyState className="ipv4-no-result" tone="error">
          {result.summary}
        </EmptyState>
      )}
      {result?.status === 'OK' && (
        <>
          <SectionTitle className="ipv4-section-title">DHCPv4 details</SectionTitle>
          {labels
            .filter(([key]) => result.fields[key])
            .map(([key, label]) => (
              <DataRow className="ipv4-row" key={key} label={label} value={result.fields[key]} />
            ))}
        </>
      )}
    </div>
  );
}

interface Ipv6ResultsProps {
  result: Ipv6DisplayResult | null;
  mode: Ipv6Mode;
  onModeChange: StateSetter<Ipv6Mode>;
  disabled: boolean;
}

export function Ipv6Results({
  result,
  mode,
  onModeChange,
  disabled,
}: Ipv6ResultsProps): ReactElement {
  const modeControl = (className = ''): ReactElement => (
    <SelectField
      className={className}
      label="IPv6 mode"
      value={mode}
      onChange={(event) => {
        onModeChange(
          event.target.value === 'dhcpv6'
            ? 'dhcpv6'
            : event.target.value === 'both'
              ? 'both'
              : 'slaac',
        );
      }}
      disabled={disabled}
    >
      <option value="slaac">SLAAC</option>
      <option value="dhcpv6">DHCPv6</option>
      <option value="both">SLAAC + DHCPv6</option>
    </SelectField>
  );
  if (!result)
    return (
      <div className="ipv6-awaiting">
        {modeControl()}
        <span>Run a measurement to discover IPv6 configuration</span>
      </div>
    );
  if (result.status !== 'OK')
    return (
      <EmptyState className="ipv6-no-result" tone="error">
        {result.summary}
      </EmptyState>
    );
  return (
    <div className="ipv6-results">
      {modeControl('ipv6-mode-label')}
      {result.results.map((item) => (
        <div className="ipv6-group" key={item.protocol}>
          <SectionTitle className="ipv6-section-title">{item.protocol}</SectionTitle>
          {Object.entries(item.fields).map(([label, value]) => (
            <DataRow
              className="ipv6-row"
              key={`${item.protocol}-${label}`}
              label={label}
              value={value}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
