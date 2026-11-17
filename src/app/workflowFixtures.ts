import type { ReportDraft, SavedReport, ToolSettings } from './types';
import { DEFAULT_MEASUREMENT_SETTINGS } from './measurementSettings';

export const workflowSettings: ToolSettings = {
  tia: '568B',
  units: 'meters',
  nvp: '71',
  customMac: 'off',
  mac: '',
};

export function workflowDraft(): ReportDraft {
  return {
    pingTargets: ['', '', ''],
    createdAt: '2026-11-12T03:00:00.000Z',
    completedAt: '2026-11-12T03:00:05.000Z',
    settings: { ...workflowSettings },
    measurementSettings: structuredClone(DEFAULT_MEASUREMENT_SETTINGS),
    selectedTests: ['wiremap'],
    failures: {},
    runError: '',
    results: {
      wiremap: {
        status: 'OK',
        summary: '4-pair straight',
        connections: [0, 1, 2, 3, 4, 5, 6, 7, 8, 0],
        shorts: Array<number>(10).fill(0),
        id: 1,
        adapterType: 2,
      },
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
    },
  };
}

export function workflowReport(id = 'report-1', tag = 'CAB-001'): SavedReport {
  return {
    ...workflowDraft(),
    id,
    details: {
      tag,
      project: 'School',
      address: 'Site A',
      user: 'Tech',
      location: 'Rack 1',
      portId: '24',
      comment: 'Note',
    },
    photos: [{ dataUrl: 'data:image/jpeg;base64,photo', description: 'Port 24\nPatch panel' }],
  };
}

export function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => {
      values.clear();
    },
    key: (index) => [...values.keys()][index] ?? null,
  };
}
