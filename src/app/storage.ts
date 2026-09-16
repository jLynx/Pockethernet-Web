import type {
  BlinkerSettings,
  ReportDetails,
  ReportPreferences,
  SavedReport,
  TonerSettings,
  ToolSettings,
  WifiSettings,
} from './types';

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  tia: '568B',
  units: 'meters',
  nvp: '71',
  customMac: 'off',
  mac: '',
};
export const DEFAULT_BLINKER_SETTINGS: BlinkerSettings = {
  speed: 'auto',
  duplex: 'auto',
  mdi: 'auto',
  link: 'off',
};
export const DEFAULT_TONER_SETTINGS: TonerSettings = {
  pair: 'all',
  shield: 'off',
  tone: '1',
  volume: 'high',
  power: 'off',
};
export const DEFAULT_WIFI_SETTINGS: WifiSettings = {
  name: 'Pockethernet',
  password: 'Pockethernet',
  enabled: 'off',
};
export const DEFAULT_REPORT_DETAILS: ReportDetails = {
  address: '',
  tag: '',
  user: '',
  location: '',
  comment: '',
  portId: '',
};
export const DEFAULT_REPORT_PREFERENCES: ReportPreferences = { logoDataUrl: '', logoName: '' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storedRecord(key: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function loadToolSettings(): ToolSettings {
  const saved = storedRecord('pockethernet.toolSettings');
  return {
    tia: saved.tia === '568A' ? '568A' : DEFAULT_TOOL_SETTINGS.tia,
    units: saved.units === 'feet' ? 'feet' : DEFAULT_TOOL_SETTINGS.units,
    nvp: typeof saved.nvp === 'string' ? saved.nvp : DEFAULT_TOOL_SETTINGS.nvp,
    customMac: saved.customMac === 'on' ? 'on' : DEFAULT_TOOL_SETTINGS.customMac,
    mac: typeof saved.mac === 'string' ? saved.mac : DEFAULT_TOOL_SETTINGS.mac,
  };
}

export function loadBlinkerSettings(): BlinkerSettings {
  const saved = storedRecord('pockethernet.blinkerSettings');
  return {
    speed:
      saved.speed === '10' || saved.speed === '100' || saved.speed === '1000'
        ? saved.speed
        : DEFAULT_BLINKER_SETTINGS.speed,
    duplex:
      saved.duplex === 'half' || saved.duplex === 'full'
        ? saved.duplex
        : DEFAULT_BLINKER_SETTINGS.duplex,
    mdi: saved.mdi === 'mdi' || saved.mdi === 'mdix' ? saved.mdi : DEFAULT_BLINKER_SETTINGS.mdi,
    link:
      saved.link === 'on' || saved.link === 'blink' ? saved.link : DEFAULT_BLINKER_SETTINGS.link,
  };
}

export function loadTonerSettings(): TonerSettings {
  const saved = storedRecord('pockethernet.tonerSettings');
  return {
    pair:
      saved.pair === '1' || saved.pair === '2' || saved.pair === '3' || saved.pair === '4'
        ? saved.pair
        : DEFAULT_TONER_SETTINGS.pair,
    shield: saved.shield === 'on' ? 'on' : DEFAULT_TONER_SETTINGS.shield,
    tone:
      saved.tone === '2' || saved.tone === '3' || saved.tone === '4'
        ? saved.tone
        : DEFAULT_TONER_SETTINGS.tone,
    volume: saved.volume === 'low' ? 'low' : DEFAULT_TONER_SETTINGS.volume,
    power: saved.power === 'on' ? 'on' : DEFAULT_TONER_SETTINGS.power,
  };
}

export function loadWifiSettings(): WifiSettings {
  const saved = storedRecord('pockethernet.wifiSettings');
  return {
    name: typeof saved.name === 'string' ? saved.name : DEFAULT_WIFI_SETTINGS.name,
    password: typeof saved.password === 'string' ? saved.password : DEFAULT_WIFI_SETTINGS.password,
    enabled: saved.enabled === 'on' ? 'on' : DEFAULT_WIFI_SETTINGS.enabled,
  };
}

export function loadReportDetails(): ReportDetails {
  const saved = storedRecord('pockethernet.reportDetails');
  return {
    address: typeof saved.address === 'string' ? saved.address : '',
    tag: typeof saved.tag === 'string' ? saved.tag : '',
    user: typeof saved.user === 'string' ? saved.user : '',
    location: typeof saved.location === 'string' ? saved.location : '',
    comment: typeof saved.comment === 'string' ? saved.comment : '',
    portId: typeof saved.portId === 'string' ? saved.portId : '',
  };
}

export function loadReportPreferences(): ReportPreferences {
  const saved = storedRecord('pockethernet.reportPreferences');
  return {
    logoDataUrl: typeof saved.logoDataUrl === 'string' ? saved.logoDataUrl : '',
    logoName: typeof saved.logoName === 'string' ? saved.logoName : '',
  };
}

export function loadReports(): SavedReport[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('pockethernet.reports') ?? '[]');
    return Array.isArray(saved) ? saved.filter(isSavedReport) : [];
  } catch {
    return [];
  }
}

function isSavedReport(value: unknown): value is SavedReport {
  if (
    !isRecord(value) ||
    !isRecord(value.details) ||
    !isRecord(value.settings) ||
    !isRecord(value.results)
  )
    return false;
  const details = value.details;
  const settings = value.settings;
  return (
    typeof value.id === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.photoDataUrl === 'string' &&
    Object.keys(DEFAULT_REPORT_DETAILS).every((key) => typeof details[key] === 'string') &&
    (settings.tia === '568A' || settings.tia === '568B') &&
    (settings.units === 'meters' || settings.units === 'feet') &&
    typeof settings.nvp === 'string'
  );
}
