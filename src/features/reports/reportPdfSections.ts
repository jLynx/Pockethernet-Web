import type { jsPDF } from 'jspdf';
import type { SavedReport, TestId } from '@/app/types';
import { tdrSummary } from '@/app/format';
import { formatScalar } from '@/app/numberFormat';
import { drawTdrChart } from './reportPdfCharts';
import { drawWiremap, formatDistance, pairColor } from './reportPdfPrimitives';

export type ReportPdfRow = readonly [label: string, value: string, color?: string];
export interface ReportPdfSection {
  title: string;
  rows: ReportPdfRow[];
  graphic?: { height: number; draw: (doc: jsPDF, y: number) => void };
}

const TEST_NAMES: Record<TestId, string> = {
  wiremap: 'Wiremap',
  tdr: 'TDR',
  'tdr-graph': 'TDR graph',
  poe: 'PoE',
  link: 'Link',
  cdplldp: 'CDP/LLDP',
  vlan: 'VLAN',
  traffic: 'Traffic',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
  ping: 'Ping',
  extip: 'External IP',
  ber: 'Error rate / BER',
};

function runStatusRows(report: SavedReport): ReportPdfRow[] {
  const rows: ReportPdfRow[] = [];
  if (report.selectedTests?.length) {
    rows.push(['Selected tests', report.selectedTests.map((id) => TEST_NAMES[id]).join(', ')]);
    for (const id of report.selectedTests) {
      const resultKey = id === 'tdr-graph' ? 'tdrGraph' : id;
      if (report.failures?.[id] || !report.results[resultKey])
        rows.push([TEST_NAMES[id], report.failures?.[id] || 'No result recorded']);
    }
  } else {
    rows.push(...Object.entries(report.failures ?? {}));
  }
  return rows;
}

export function reportPdfSections(report: SavedReport): ReportPdfSection[] {
  const sections: ReportPdfSection[] = [];
  const { results, settings } = report;
  const add = (
    title: string,
    result: { summary: string } | null,
    rows: ReportPdfRow[] = [],
    graphic?: ReportPdfSection['graphic'],
  ): void => {
    if (!result) return;
    const populated = rows.filter(([, value]) => value.trim());
    if (!result.summary.trim() && !populated.length && !graphic) return;
    sections.push({
      title,
      rows: [...(result.summary.trim() ? [['', result.summary] as const] : []), ...populated],
      graphic,
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
      runStatusRows(report),
    );
  }
  add(
    'Wiremap',
    results.wiremap,
    [],
    results.wiremap
      ? {
          height: 28,
          draw: (doc, y) => drawWiremap(doc, report, 12, y - 2, false),
        }
      : undefined,
  );
  const poe = results.poe;
  add(
    'PoE',
    poe,
    poe
      ? [
          ['Open voltage', formatScalar(`${poe.openVoltage} V`, settings.decimalSeparator)],
          ['Polarity', poe.polarity],
          ['Load voltage', formatScalar(`${poe.loadVoltage} V`, settings.decimalSeparator)],
          ['PSE type', poe.poeType],
          ['Max. class', poe.maxClass ?? ''],
        ]
      : [],
  );
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
          ...link.polarity.map((value, index): ReportPdfRow => [
            `P${[2, 3, 1, 4][index]}`,
            value,
            pairColor(settings.tia, index),
          ]),
        ]
      : [],
  );
  add(
    'TDR',
    results.tdr
      ? { summary: tdrSummary(results.tdr, settings.units, settings.decimalSeparator) }
      : null,
    results.tdr?.pairs.map((pair, index): ReportPdfRow => [
      `P${[2, 3, 1, 4][index]}`,
      pair.status
        ? `${pair.status} @ ${formatDistance(pair.distance, settings.units, settings.decimalSeparator)}`
        : '-',
      pairColor(settings.tia, index),
    ]) ?? [],
  );
  const graph = results.tdrGraph;
  if (
    graph &&
    (graph.impedance.some((trace) => trace.length) || graph.crosstalk.some((trace) => trace.length))
  ) {
    add('TDR Graph', { summary: '' }, [], {
      height: 40,
      draw: (doc, y) => {
        for (const [index, kind] of (['impedance', 'crosstalk'] as const).entries()) {
          if (graph[kind].some((trace) => trace.length))
            drawTdrChart(
              doc,
              graph,
              kind,
              12 + index * 95,
              y,
              90,
              40,
              settings.units,
              settings.tia,
              settings.decimalSeparator,
            );
        }
      },
    });
  }
  add('DHCPv4', results.ipv4, results.ipv4 ? fields(results.ipv4.fields) : []);
  const ipv6 = results.ipv6;
  ipv6?.results.forEach((result) => {
    add(result.protocol === 'SLAAC' ? 'IPv6 ND' : 'DHCPv6', result, fields(result.fields));
  });
  if (ipv6 && (!ipv6.results.length || ipv6.status === 'not_OK')) add('IPv6', ipv6);
  add(
    'Ping',
    results.ping,
    results.ping?.servers.map((server, index): ReportPdfRow => [
      `Server ${index}`,
      `${server.ip} / ${formatScalar(server.time, settings.decimalSeparator)}`,
    ]) ?? [],
  );
  add('External IP', results.extip, results.extip ? fields(results.extip.fields) : []);
  const ber = results.ber;
  add(
    'Error rate',
    ber
      ? { summary: `Error rate: ${formatScalar(ber.errorRate, settings.decimalSeparator)}` }
      : null,
    ber
      ? [
          ['Sent packets', String(ber.sent)],
          ['Received', String(ber.received)],
          ['Packets with error', String(ber.errors)],
          ['Error ratio', formatScalar(ber.errorRate, settings.decimalSeparator)],
        ]
      : [],
  );
  const discovery = results.cdplldp;
  if (discovery) {
    add(discovery.status === 'OK' ? discovery.protocol : 'CDP/LLDP', discovery, [
      ...(discovery.status === 'OK' ? [['Eth Src Addr', discovery.source] as const] : []),
      ...fields(discovery.fields).filter(
        ([key]) => key !== 'Eth Dst Addr' && key !== 'Protocol' && key !== 'Eth Src Addr',
      ),
    ]);
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
