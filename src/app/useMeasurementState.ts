import { useState } from 'react';
import type { MeasurementContext } from './runMeasurements';
import type { ReportDraft, ReportResults, StateSetter, TestId, MeasurementFailures } from './types';

export function emptyResults(): ReportResults {
  return {
    wiremap: null,
    tdr: null,
    tdrGraph: null,
    ber: null,
    poe: null,
    link: null,
    cdplldp: null,
    vlan: null,
    traffic: null,
    ipv4: null,
    ipv6: null,
    ping: null,
    extip: null,
  };
}

function useMeasurementStateInternal() {
  const [results, setResults] = useState<ReportResults>(emptyResults);
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [expanded, setExpanded] = useState<Set<TestId>>(new Set());
  const [running, setRunning] = useState(false);
  const [activeTest, setActiveTest] = useState<TestId | null>(null);
  const [failures, setFailures] = useState<MeasurementFailures>({});
  const [pendingTests, setPendingTests] = useState<Set<TestId>>(new Set());
  const setter =
    <Key extends keyof ReportResults>(key: Key): StateSetter<ReportResults[Key]> =>
    (update) =>
      setResults((current) => ({
        ...current,
        [key]: typeof update === 'function' ? update(current[key]) : update,
      }));
  const setters: Pick<
    MeasurementContext,
    | 'setWiremap'
    | 'setTdr'
    | 'setTdrGraph'
    | 'setBer'
    | 'setPoe'
    | 'setLink'
    | 'setCdplldp'
    | 'setVlan'
    | 'setTraffic'
    | 'setIpv4'
    | 'setIpv6'
    | 'setPing'
    | 'setExtip'
    | 'setRunning'
    | 'setExpanded'
    | 'setActiveTest'
    | 'setFailures'
    | 'setPendingTests'
  > = {
    setWiremap: setter('wiremap'),
    setTdr: setter('tdr'),
    setTdrGraph: setter('tdrGraph'),
    setBer: setter('ber'),
    setPoe: setter('poe'),
    setLink: setter('link'),
    setCdplldp: setter('cdplldp'),
    setVlan: setter('vlan'),
    setTraffic: setter('traffic'),
    setIpv4: setter('ipv4'),
    setIpv6: setter('ipv6'),
    setPing: setter('ping'),
    setExtip: setter('extip'),
    setRunning,
    setExpanded,
    setActiveTest,
    setFailures,
    setPendingTests,
  };
  return {
    results,
    setResults,
    draft,
    setDraft,
    expanded,
    setExpanded,
    running,
    activeTest,
    failures,
    pendingTests,
    setters,
  };
}

export function useMeasurementState(): ReturnType<typeof useMeasurementStateInternal> {
  return useMeasurementStateInternal();
}
