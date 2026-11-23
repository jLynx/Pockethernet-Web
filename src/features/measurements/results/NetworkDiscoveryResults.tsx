import type { ReactElement } from 'react';
import {
  discoveryHostFields,
  discoveryHostName,
  discoveryNotes,
  igmpQuerierStatus,
} from '@/app/discoveryDisplay';
import type { NetworkDiscoveryResult } from '@/app/types';
import type { SegmentObservation } from '@/protocol/networkDiscovery';
import { DataRow, EmptyState, SectionTitle } from '@/shared/ui/UiPrimitives';

export function NetworkDiscoveryResults({
  result,
}: {
  result?: NetworkDiscoveryResult | null;
}): ReactElement | null {
  if (!result) return null;
  const running = result.state === 'listening' || result.state === 'scanning';
  const querier = igmpQuerierStatus(result);
  const hosts = [...result.hosts].sort((a, b) =>
    a.ip.localeCompare(b.ip, undefined, { numeric: true }),
  );
  const byProtocol = new Map<string, SegmentObservation[]>();
  for (const observation of result.observations) {
    const group = byProtocol.get(observation.label);
    if (group) group.push(observation);
    else byProtocol.set(observation.label, [observation]);
  }
  const renderFields = (entries: [string, string | number][]) =>
    entries.map(([label, value]) => (
      <DataRow className="cdplldp-row" key={label} label={label} value={String(value)} />
    ));
  return (
    <div className="network-discovery-results">
      {running && <p role="status">{result.summary}</p>}
      {discoveryNotes(result).map((note) => (
        <p key={note}>{note}</p>
      ))}
      {hosts.length > 0 && <SectionTitle>Hosts</SectionTitle>}
      {hosts.map((host) => (
        <details key={`${host.ip}:${host.mac ?? ''}`}>
          <summary>
            {[host.ip === '0.0.0.0' ? host.mac : host.ip, discoveryHostName(host), host.vendor]
              .filter(Boolean)
              .join(' · ')}
          </summary>
          {renderFields(discoveryHostFields(host))}
        </details>
      ))}
      {(byProtocol.size > 0 || querier) && <SectionTitle>Segment observations</SectionTitle>}
      {result.listenMs !== undefined && (
        <DataRow
          className="cdplldp-row"
          label="Listen time"
          value={`${(result.listenMs / 1000).toFixed(1)} s`}
        />
      )}
      {querier && <DataRow className="cdplldp-row" label="IGMP querier" value={querier} />}
      {[...byProtocol].map(([protocol, records]) => (
        <details key={protocol}>
          <summary>
            {protocol} ({records.length})
          </summary>
          {records.map((record) => (
            <div className="network-discovery-observation" key={record.key}>
              {renderFields(Object.entries(record.fields))}
            </div>
          ))}
        </details>
      ))}
      {!running && result.status === 'OK' && !hosts.length && !byProtocol.size && (
        <EmptyState>No devices or segment traffic found</EmptyState>
      )}
    </div>
  );
}
