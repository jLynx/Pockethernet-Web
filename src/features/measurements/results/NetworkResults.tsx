import { useDecimalSeparator } from '@/app/decimalPreference';
import { formatScalar } from '@/app/numberFormat';
import type { ReactElement } from 'react';
import type { FieldsResult } from '@/pockethernetProtocol';
import type {
  DiscoveryResult,
  Ipv6DisplayResult,
  PingDisplayResult,
  TrafficDisplayResult,
  VlanDisplayResult,
} from '@/app/types';
import { DataRow, EmptyState, SectionTitle } from '@/shared/ui/UiPrimitives';

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

export function VlanResults({ result }: { result: VlanDisplayResult | null }): ReactElement {
  const rows = result?.status === 'OK' ? result.tags : [];
  return (
    <div className="vlan-results">
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

export function PingResults({ result }: { result: PingDisplayResult | null }): ReactElement {
  const separator = useDecimalSeparator();
  if (!result) return <EmptyState>Run a measurement to ping the configured targets</EmptyState>;
  return (
    <div className="ping-results">
      {result.servers.map((server, index) => (
        <div className="ping-server" key={index}>
          <SectionTitle>Server {index}</SectionTitle>
          <DataRow className="ping-row" label="IP" value={server.ip} />
          <DataRow
            className="ping-row"
            label="Avg time"
            value={formatScalar(server.time, separator)}
          />
        </div>
      ))}
    </div>
  );
}

export function Ipv4Results({ result }: { result: FieldsResult | null }): ReactElement {
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
  return (
    <div className="ipv4-results">
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

export function Ipv6Results({ result }: { result: Ipv6DisplayResult | null }): ReactElement {
  if (!result)
    return (
      <div className="ipv6-awaiting">
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
