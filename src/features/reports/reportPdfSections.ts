import type { jsPDF } from 'jspdf';
import type { SavedReport, TestId } from '@/app/types';
import { tdrSummary } from '@/app/format';
import {
  discoveryHostFields,
  discoveryHostName,
  discoveryNotes,
  igmpQuerierStatus,
} from '@/app/discoveryDisplay';
import { formatScalar } from '@/app/numberFormat';
import { linkEeeText, linkSnrText } from '@/pockethernetProtocol';
import { drawTdrChart } from './reportPdfCharts';
import { drawWiremap, formatDistance, pairColor } from './reportPdfPrimitives';
import { REPORT_TESTS, type ReportPdfVerdict } from './reportPdfVerdicts';

export type ReportPdfRow = readonly [label: string, value: string, color?: string];
export interface ReportPdfSection {
  title: string;
  rows: ReportPdfRow[];
  summary?: string;
  verdict?: ReportPdfVerdict;
  column?: 0 | 1 | 2;
  pairedRows?: [left: ReportPdfRow[], right: ReportPdfRow[]];
  graphic?: { height: number; draw: (doc: jsPDF, x: number, y: number, width: number) => void };
}

function runStatusRows(
  report: SavedReport,
  verdicts: ReadonlyMap<TestId, ReportPdfVerdict>,
): ReportPdfRow[] {
  const rows: ReportPdfRow[] = [];
  if (report.selectedTests?.length)
    rows.push([
      'Selected tests',
      report.selectedTests.map((id) => REPORT_TESTS[id]?.[0] ?? id).join(', '),
    ]);
  for (const [id, verdict] of verdicts) {
    const [title, key] = REPORT_TESTS[id];
    const failure = report.failures?.[id];
    if (failure || verdict === 'incomplete')
      rows.push([
        title,
        failure || (report.results[key] ? 'Partial result recorded' : 'No result recorded'),
      ]);
  }
  return rows;
}

export function reportPdfSections(
  report: SavedReport,
  verdicts: ReadonlyMap<TestId, ReportPdfVerdict>,
): ReportPdfSection[] {
  const sections: ReportPdfSection[] = [];
  const { results, settings } = report;
  const add = (
    title: string,
    result: { summary: string } | null,
    rows: ReportPdfRow[] = [],
    options: Pick<ReportPdfSection, 'column' | 'graphic' | 'verdict'> & { test?: TestId } = {},
  ): void => {
    if (!result) return;
    const populated = rows.filter(([, value]) => value.trim());
    if (!result.summary.trim() && !populated.length && !options.graphic) return;
    const { test, ...appearance } = options;
    sections.push({
      title,
      rows: populated,
      summary: result.summary.trim(),
      ...appearance,
      verdict: appearance.verdict ?? (test ? verdicts.get(test) : undefined),
    });
  };
  const fields = (values: Record<string, string>): ReportPdfRow[] => Object.entries(values);
  if (
    report.selectedTests?.length ||
    report.runError ||
    Object.keys(report.failures ?? {}).length
  ) {
    add(
      'Run status',
      {
        summary:
          report.runError ||
          (Object.keys(report.failures ?? {}).length ? 'Completed with test failures' : ''),
      },
      runStatusRows(report, verdicts),
    );
  }
  add('Wiremap', results.wiremap, [], {
    test: 'wiremap',
    column: 0,
    graphic: {
      height: 26,
      draw: (doc, x, y, width) => drawWiremap(doc, report, x, y - 1, width),
    },
  });
  const poe = results.poe;
  const link = results.link;
  add(
    'Link',
    link,
    link?.linkUp
      ? [
          ['2.5/5/10G', link.partnerCapabilities.multig],
          ['1000 Mbit', link.partnerCapabilities['1000M']],
          ['100 Mbit', link.partnerCapabilities['100M']],
          ['10 Mbit', link.partnerCapabilities['10M']],
          ['EEE advertised by partner', linkEeeText(link.eeePartnerMbps) ?? ''],
          ...(link.mse ?? []).map((mse, index): ReportPdfRow => [
            `P${[2, 3, 1, 4][index]} RX-SNR`,
            linkSnrText(mse) ?? '',
            pairColor(settings.tia, index),
          ]),
          ...link.polarity.map((value, index): ReportPdfRow => [
            `P${[2, 3, 1, 4][index]}`,
            value,
            pairColor(settings.tia, index),
          ]),
          ['Pair skew (ns)', link.skewDelay?.join(' / ') ?? ''],
        ]
      : [],
    { test: 'link', column: 0 },
  );
  add(
    'PoE',
    poe,
    poe
      ? [
          ['PSE type', poe.poeType],
          ['Max. class', poe.maxClass ?? ''],
          ['Open voltage', formatScalar(`${poe.openVoltage} V`, settings.decimalSeparator)],
          ['Load voltage', formatScalar(`${poe.loadVoltage} V`, settings.decimalSeparator)],
          ['Polarity', poe.polarity],
        ]
      : [],
    { test: 'poe', column: 0 },
  );
  add(
    'TDR',
    results.tdr
      ? {
          summary: results.tdr.pairs.length
            ? tdrSummary(results.tdr, settings.units, settings.decimalSeparator)
            : results.tdr.summary,
        }
      : null,
    results.tdr?.pairs.map((pair, index): ReportPdfRow => [
      `P${[2, 3, 1, 4][index]}`,
      pair.status
        ? `${pair.status} @ ${formatDistance(pair.distance, settings.units, settings.decimalSeparator)}`
        : '-',
      pairColor(settings.tia, index),
    ]) ?? [],
    { test: 'tdr', column: 0 },
  );
  const graph = results.tdrGraph;
  if (graph) {
    for (const [kind, title] of [
      ['impedance', 'Impedance'],
      ['crosstalk', 'Crosstalk'],
    ] as const) {
      if (!graph[kind].some((trace) => trace.length)) continue;
      add(title, { summary: '' }, [], {
        column: 1,
        test: 'tdr-graph',
        graphic: {
          height: 27,
          draw: (doc, x, y, width) =>
            drawTdrChart(
              doc,
              graph,
              kind,
              x,
              y,
              width,
              27,
              settings.units,
              settings.tia,
              settings.decimalSeparator,
            ),
        },
      });
    }
  }
  const ipv4 = results.ipv4;
  add('DHCPv4', ipv4, ipv4 ? fields(ipv4.fields) : [], {
    test: 'ipv4',
    column: 1,
  });
  const ipv6 = results.ipv6;
  ipv6?.results.forEach((result) => {
    add(result.protocol === 'SLAAC' ? 'IPv6 ND' : 'DHCPv6', result, fields(result.fields), {
      verdict: result.status === 'OK' ? 'pass' : 'fail',
      column: 2,
    });
  });
  if (ipv6 && (!ipv6.results.length || ipv6.status === 'not_OK'))
    add('IPv6', ipv6, [], { test: 'ipv6', column: 2 });
  add(
    'Ping',
    results.ping,
    results.ping?.servers.map((server, index): ReportPdfRow => [
      `Server ${index}`,
      `${server.ip} / ${formatScalar(server.time, settings.decimalSeparator)}`,
      server.status === 'not_OK' ? '#a2373a' : undefined,
    ]) ?? [],
    { test: 'ping', column: 2 },
  );
  add('External IP', results.extip, results.extip ? fields(results.extip.fields) : [], {
    test: 'extip',
    column: 2,
  });
  const ber = results.ber;
  const berSettings = report.measurementSettings?.berSettings;
  const berRows: ReportPdfRow[] = berSettings
    ? [
        ['Speed', `${berSettings.speed} Mbps`],
        [
          'Frame size',
          berSettings.frameSize === 'both'
            ? '64 / 1514 bytes'
            : berSettings.frameSize === 64
              ? '64 bytes'
              : '1514 bytes',
        ],
        ['Payload', berSettings.payloadMode === 'random' ? 'Random' : '0x55'],
      ]
    : [];
  add(
    'Error rate',
    ber
      ? { summary: `Error rate: ${formatScalar(ber.errorRate, settings.decimalSeparator)}` }
      : null,
    ber
      ? [
          ...berRows,
          ['Sent packets', String(ber.sent)],
          ['Received', String(ber.received)],
          ['Lost packets', String(Math.max(0, ber.sent - ber.received))],
          ['Packets with error', String(ber.errors)],
          ['Error ratio', formatScalar(ber.errorRate, settings.decimalSeparator)],
        ]
      : [],
    { test: 'ber', column: 2 },
  );
  const networkDiscovery = results.networkDiscovery;
  if (networkDiscovery) {
    const rows: ReportPdfRow[] = [
      ['Mode', networkDiscovery.mode === 'active' ? 'Active' : 'Passive'],
      ...discoveryNotes(networkDiscovery).map((note): ReportPdfRow => ['', note]),
    ];
    if (networkDiscovery.listenMs !== undefined)
      rows.push(['Listen time', `${(networkDiscovery.listenMs / 1000).toFixed(1)} s`]);
    const querier = igmpQuerierStatus(networkDiscovery);
    if (querier) rows.push(['IGMP querier status', querier]);
    for (const host of networkDiscovery.hosts) {
      const address = host.ip === '0.0.0.0' ? (host.mac ?? 'Unknown address') : host.ip;
      const name = discoveryHostName(host);
      if (name) rows.push([address, name]);
      for (const [field, value] of discoveryHostFields(host))
        rows.push([`${address} · ${field}`, String(value)]);
    }
    for (const observation of networkDiscovery.observations) {
      rows.push([
        observation.label,
        Object.entries(observation.fields)
          .map(([field, value]) => `${field} ${value}`)
          .join(', '),
      ]);
    }
    add('Network Discovery', networkDiscovery, rows, { test: 'network-discovery' });
  }
  const discovery = results.cdplldp;
  if (discovery) {
    add(discovery.status === 'OK' ? discovery.protocol : 'CDP/LLDP', discovery, [
      ...(discovery.status === 'OK' ? [['Eth Src Addr', discovery.source] as const] : []),
      ...fields(discovery.fields).filter(
        ([key]) => key !== 'Eth Dst Addr' && key !== 'Protocol' && key !== 'Eth Src Addr',
      ),
    ]);
  }
  for (const id of ['cdp', 'lldp'] as const) {
    const result = results[id];
    if (!result) continue;
    const announcements = result.announcements ?? (result.status === 'OK' ? [result] : []);
    add(
      id.toUpperCase(),
      result,
      announcements.flatMap((entry): ReportPdfRow[] => [
        ['Eth Src Addr', entry.source],
        ...fields(entry.fields).filter(
          ([key]) => key !== 'Eth Dst Addr' && key !== 'Protocol' && key !== 'Eth Src Addr',
        ),
      ]),
      { test: id },
    );
  }
  add(
    'VLAN',
    results.vlan,
    results.vlan?.tags.map((tag): ReportPdfRow => [
      `VLAN ${tag.id}`,
      `Priority ${tag.priority}, DEI ${tag.dei ? '1' : '0'}`,
    ]) ?? [],
  );
  add(
    'Traffic',
    results.traffic,
    results.traffic?.packets.map((packet, index): ReportPdfRow => [
      `Packet ${index + 1}`,
      `${packet.source} -> ${packet.destination}, VLAN ${packet.vlanId}`,
    ]) ?? [],
  );
  return sections;
}
