import type { Dispatch, SetStateAction } from 'react';
import type {
  BerFrameSize,
  BerPayloadMode,
  BerResult,
  BerSpeed,
  BlinkerDuplex,
  BlinkerLink,
  BlinkerMdi,
  BlinkerSpeed,
  CdpLldpResult,
  FieldsResult,
  FirmwareVersionResult,
  Ipv4Mode,
  LinkResult,
  PingPacketResult,
  PoeResult,
  ResultStatus,
  TdrResult,
  TonerPair,
  TonerShield,
  TonerTone,
  TonerVolume,
  TrafficPacketResult,
  VlanTag,
  WiremapResult,
} from '@/pockethernetProtocol';

export type Tab = 'test' | 'configure' | 'report' | 'tools' | 'settings';
export type WorkflowMode = 'single' | 'batch';
export type TestId =
  | 'wiremap'
  | 'tdr'
  | 'tdr-graph'
  | 'ber'
  | 'poe'
  | 'link'
  | 'cdplldp'
  | 'vlan'
  | 'traffic'
  | 'ipv4'
  | 'ipv6'
  | 'ping'
  | 'extip';
export type Units = 'meters' | 'feet';
export type MeasurementFailures = Partial<Record<TestId, string>>;
export type TiaStandard = '568A' | '568B';
export type OnOff = 'on' | 'off';
export type StateSetter<T> = Dispatch<SetStateAction<T>>;
export type PanelStatus = 'idle' | 'ok' | 'error';
export type AppIconName = 'test' | 'configure' | 'report' | 'tools' | 'device' | 'settings';
export type FirmwareCheck = FirmwareVersionResult | { error: string };

export interface ToolSettings {
  tia: TiaStandard;
  units: Units;
  nvp: string;
  customMac: OnOff;
  mac: string;
  shieldTest?: boolean;
  allowCrossover?: boolean;
  requiredPairs?: 'any' | '2' | '4';
  decimalSeparator?: '.' | ',';
}

export interface PingDefaults {
  enabled: boolean;
  targets: [string, string, string];
}

export interface ReportDetails {
  address: string;
  tag: string;
  user: string;
  location: string;
  comment: string;
  portId: string;
  project?: string;
}

export interface ReportPreferences {
  logoDataUrl: string;
  logoName: string;
  showFooterLogo: boolean;
}

export interface ReportResults {
  wiremap: WiremapResult | null;
  tdr: TdrResult | null;
  tdrGraph: TdrGraphResult | null;
  ber: BerDisplayResult | null;
  poe: PoeResult | null;
  link: LinkResult | null;
  cdplldp: DiscoveryResult | null;
  vlan: VlanDisplayResult | null;
  traffic: TrafficDisplayResult | null;
  ipv4: FieldsResult | null;
  ipv6: Ipv6DisplayResult | null;
  ping: PingDisplayResult | null;
  extip: FieldsResult | null;
}

export interface ReportPhoto {
  dataUrl: string;
  description: string;
}

export interface SavedReport {
  id: string;
  createdAt: string;
  details: ReportDetails;
  settings:
    | ToolSettings
    | Pick<
        ToolSettings,
        | 'tia'
        | 'units'
        | 'nvp'
        | 'shieldTest'
        | 'allowCrossover'
        | 'requiredPairs'
        | 'decimalSeparator'
      >;
  results: ReportResults;
  photos: ReportPhoto[];
  selectedTests?: TestId[];
  failures?: MeasurementFailures;
  runError?: string;
  completedAt?: string;
  measurementSettings?: MeasurementSettings;
  pingTargets?: string[];
}

export interface MeasurementSettings {
  berSettings: BerSettings;
  vlanSettings: VlanSettings;
  ipv4Settings: Ipv4UiSettings;
  ipv6Mode: 'slaac' | 'dhcpv6' | 'both';
  discoveryTimeout: 10000 | 30000 | 60000;
}

export interface ReportDraft {
  createdAt: string;
  completedAt: string;
  settings: ToolSettings;
  results: ReportResults;
  selectedTests: TestId[];
  failures: MeasurementFailures;
  runError: string;
  measurementSettings: MeasurementSettings;
  pingTargets: string[];
}

export interface BlinkerSettings {
  speed: BlinkerSpeed;
  duplex: BlinkerDuplex;
  mdi: BlinkerMdi;
  link: BlinkerLink;
}

export interface TonerSettings {
  pair: TonerPair;
  shield: TonerShield;
  tone: TonerTone;
  volume: TonerVolume;
  power: OnOff;
}

export interface WifiSettings {
  name: string;
  password: string;
  enabled: OnOff;
}

export interface BerSettings {
  speed: BerSpeed;
  frameSize: BerFrameSize | 'both';
  payloadMode: BerPayloadMode;
  total: number;
}

export interface VlanSettings {
  tagging: boolean;
  id: string;
}

export interface Ipv4UiSettings {
  mode: Ipv4Mode;
  ip: string;
  netmask: string;
  gateway: string;
  dns: string;
}

export interface TdrGraphResult {
  impedance: number[][];
  crosstalk: number[][];
  nvp: number;
}

export interface BerDisplayResult extends BerResult {
  completedBatches: number;
  batchCount: number;
}

export interface VlanDisplayResult {
  status: ResultStatus;
  summary: string;
  tags: VlanTag[];
}

export interface TrafficDisplayResult {
  status: ResultStatus;
  summary: string;
  packets: TrafficPacketResult[];
}

export interface Ipv6DisplayResult {
  status: ResultStatus;
  summary: string;
  results: (FieldsResult & { protocol: 'DHCPv6' | 'SLAAC' })[];
}

export interface PingDisplayResult {
  status: ResultStatus;
  summary: string;
  servers: PingPacketResult[];
}

export interface DiscoveryFailure extends FieldsResult {
  status: 'not_OK';
}

export type DiscoveryResult = CdpLldpResult | DiscoveryFailure;

export interface ChartSeries {
  label: string;
  color: string;
}

export const SUPPORTED_TESTS: readonly TestId[] = [
  'wiremap',
  'tdr',
  'tdr-graph',
  'ber',
  'poe',
  'link',
  'cdplldp',
  'vlan',
  'traffic',
  'ipv4',
  'ipv6',
  'ping',
  'extip',
];
