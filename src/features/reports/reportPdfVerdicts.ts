import type { ReportResults, SavedReport, TestId } from '@/app/types';
import { SUPPORTED_TESTS } from '@/app/types';

export type ReportPdfVerdict = 'pass' | 'fail' | 'incomplete' | 'recorded';

export const REPORT_TESTS: Record<TestId, readonly [title: string, key: keyof ReportResults]> = {
  wiremap: ['Wiremap', 'wiremap'],
  tdr: ['TDR', 'tdr'],
  'tdr-graph': ['TDR graph', 'tdrGraph'],
  poe: ['PoE', 'poe'],
  link: ['Link', 'link'],
  'network-discovery': ['Network Discovery', 'networkDiscovery'],
  cdplldp: ['CDP/LLDP', 'cdplldp'],
  cdp: ['CDP', 'cdp'],
  lldp: ['LLDP', 'lldp'],
  vlan: ['VLAN', 'vlan'],
  traffic: ['Traffic', 'traffic'],
  ipv4: ['IPv4', 'ipv4'],
  ipv6: ['IPv6', 'ipv6'],
  ping: ['Ping', 'ping'],
  extip: ['External IP', 'extip'],
  ber: ['Error rate / BER', 'ber'],
};

export function reportPdfVerdicts(report: SavedReport): {
  tests: Map<TestId, ReportPdfVerdict>;
  overall: ReportPdfVerdict;
  failed: number;
  incomplete: number;
} {
  const tests = new Map<TestId, ReportPdfVerdict>();
  for (const id of SUPPORTED_TESTS) {
    const result = report.results[REPORT_TESTS[id][1]];
    if (report.failures?.[id]) {
      tests.set(id, 'fail');
    } else if (!result) {
      if (report.selectedTests?.includes(id)) tests.set(id, 'incomplete');
    } else if (id === 'ber' && report.results.ber) {
      const { errors, sent, received, completedBatches, batchCount } = report.results.ber;
      tests.set(
        id,
        errors > 0 || received < sent
          ? 'fail'
          : sent === 0 || completedBatches < batchCount
            ? 'incomplete'
            : 'pass',
      );
    } else if (id === 'tdr-graph' && report.results.tdrGraph) {
      const { impedance, crosstalk } = report.results.tdrGraph;
      tests.set(
        id,
        [...impedance, ...crosstalk].some((trace) => trace.length >= 2) ? 'recorded' : 'incomplete',
      );
    } else if (
      id === 'tdr' ||
      id === 'cdplldp' ||
      id === 'cdp' ||
      id === 'lldp' ||
      id === 'vlan' ||
      id === 'traffic'
    ) {
      // These sections document observations. An explicit run failure still counts.
      tests.set(id, 'recorded');
    } else if ('status' in result) {
      tests.set(id, result.status === 'OK' ? 'pass' : 'fail');
    }
  }
  const outcomes = [...tests.values()];
  const failed = outcomes.filter((value) => value === 'fail').length;
  const incomplete = outcomes.filter((value) => value === 'incomplete').length;
  let overall: ReportPdfVerdict = 'recorded';
  if (failed) overall = 'fail';
  else if (report.runError || incomplete) overall = 'incomplete';
  else if (outcomes.includes('pass')) overall = 'pass';
  return { tests, overall, failed, incomplete };
}
