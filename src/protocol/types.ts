export type Packet = { type: number; payload: Uint8Array<ArrayBuffer> };
export type ResultStatus = 'OK' | 'not_OK';
export type FieldMap = Record<string, string>;
export type Ipv4Mode = 'dhcp' | 'static';
export type Ipv6Mode = 'slaac' | 'dhcpv6' | 'both';
export type BlinkerSpeed = '10' | '100' | '1000' | 'auto';
export type BlinkerDuplex = 'half' | 'full' | 'auto';
export type BlinkerMdi = 'mdi' | 'mdix' | 'auto';
export type BlinkerLink = 'off' | 'on' | 'blink';
export type TonerPair = '1' | '2' | '3' | '4' | 'all';
export type TonerShield = 'on' | 'off';
export type TonerTone = '1' | '2' | '3' | '4';
export type TonerVolume = 'low' | 'high';
export type BerSpeed = 10 | 100 | 1000;
export type BerFrameSize = 64 | 1500;
export type BerPayloadMode = 'random' | '55';

export interface Ipv4Settings {
  mode?: Ipv4Mode;
  ip?: string;
  netmask?: string;
  gateway?: string;
  dns?: string;
}

export interface DeviceInfo {
  serial: number;
  hardwareVersion: number;
  stmVersion: number;
  espVersion: number;
  mac: string;
}

export interface BasicResult {
  status: ResultStatus;
  summary: string;
}

export interface FieldsResult extends BasicResult {
  fields: FieldMap;
}

export interface TrafficPacketResult {
  source: string;
  destination: string;
  vlanId: string;
}

export interface PingPacketResult {
  status: ResultStatus;
  ip: string;
  time: string;
}

export interface BerResult {
  sent: number;
  received: number;
  errors: number;
  ratio: number;
  errorRate: string;
  summary: string;
}

export interface LinkResultOk extends BasicResult {
  status: 'OK';
  linkUp: true;
  speed: 10 | 100 | 1000;
  duplex: 'Full duplex' | 'Half duplex';
  partnerCapabilities: Record<'10M' | '100M' | '1000M' | 'multig', string>;
  polarity: string[];
  skewDelay: number[];
  lengthEstimate: number | null;
}

export interface LinkResultDown extends BasicResult {
  status: 'not_OK';
  linkUp: false;
}

export type LinkResult = LinkResultOk | LinkResultDown;

export interface CdpLldpResult extends FieldsResult {
  status: 'OK';
  protocol: 'CDP' | 'LLDP';
  source: string;
}

export interface VlanTag {
  id: number;
  priority: number;
  dei: boolean;
}

export interface PoeResult extends BasicResult {
  poeType: string;
  openVoltage: number;
  loadVoltage: number;
  polarity: string;
  adc: number[];
  pairVoltages: number[];
  maxClass?: string;
  unbalanced?: boolean;
}

export interface FirmwareVersionResult {
  latestVersion: number;
  downloadUrl: string;
  updateAvailable: boolean;
  message: string;
}

export interface WiremapResult extends BasicResult {
  connections: number[];
  shorts: number[];
  id: number;
  adapterType: 0 | 1 | 2;
}

export interface TdrPairResult {
  status: '' | 'Terminated' | 'Short' | 'Open';
  distance: number;
  samples: number[];
  peakIndex?: number;
  peakValue?: number;
}

export interface TdrResult extends BasicResult {
  pairs: TdrPairResult[];
  nvp: number;
}

export interface TdrCrosstalkResult {
  traces: number[][];
  nvp: number;
}
