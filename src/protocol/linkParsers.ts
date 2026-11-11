import type { LinkResult, PoeResult } from './types';

function partnerCapability(value: number): string {
  return ['Not advertised', 'Half Duplex', 'Full Duplex', 'Half & Full Duplex'][value] ?? 'Unknown';
}

export function parseLinkPacket(payload: Uint8Array): LinkResult {
  if (payload.length < 14)
    throw new Error(
      `Invalid Link response: expected at least 14 bytes, received ${payload.length}`,
    );
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const statusFlags = view.getUint16(10, true);
  if ((statusFlags & 64) === 0) return { status: 'not_OK', summary: 'No link', linkUp: false };
  const speed = statusFlags & 512 ? 1000 : statusFlags & 64 ? 100 : 10;
  const duplex = statusFlags & 128 ? 'Full duplex' : 'Half duplex';
  const polarityFlags = view.getUint16(12, true);
  const multigbase = payload.length >= 26 ? view.getUint16(24, true) : 0;
  const multig: string[] = [];
  if (multigbase & 4096) multig.push('2.5G');
  if (multigbase & 16384) multig.push('NBase-T 2.5G');
  if (multigbase & 2048) multig.push('5G');
  if (multigbase & 32768) multig.push('Nbase-T 5G');
  if (multigbase & 1) multig.push('10G');
  if (multigbase & 512) multig.push('25G');
  if (multigbase & 1024) multig.push('40G');
  return {
    status: 'OK',
    linkUp: true,
    speed,
    duplex,
    summary: `Link Up, ${speed} Mbit, ${duplex}`,
    partnerCapabilities: {
      '10M': partnerCapability((view.getUint16(4, true) >>> 5) & 3),
      '100M': partnerCapability((view.getUint16(4, true) >>> 7) & 3),
      '1000M': partnerCapability((view.getUint16(8, true) >>> 10) & 3),
      multig: multig.length ? multig.join(', ') : 'Not advertised',
    },
    polarity: [1024, 2048, 4096, 8192].map((flag) =>
      polarityFlags & flag ? 'Inverted' : 'Normal',
    ),
    skewDelay:
      payload.length >= 28
        ? [0, 1, 2, 3].map((index) => ((view.getUint16(26, true) >>> (index * 3)) & 7) * 8)
        : [],
    lengthEstimate: payload.length >= 30 ? view.getInt16(28, true) : null,
  };
}

function poeClass(value: number): string {
  const classes: Record<number, string> = {
    0: '0 (15W)',
    1: '1 (4W)',
    2: '2 (7W)',
    3: '3 (15W)',
    4: '4 (30W)',
    5: '5 (45W)',
    6: '6 (60W)',
    7: '7 (75W)',
    8: '8 (100W)',
  };
  return classes[value] ?? String(value);
}

export function parsePoePacket(payload: Uint8Array): PoeResult {
  if (payload.length !== 32)
    throw new Error(`Invalid PoE response: expected 32 bytes, received ${payload.length}`);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const rawOpenVoltage = view.getInt16(4, true);
  // measdata_pen.smali: the raw short is checked before rounding or mode classification.
  if (rawOpenVoltage === 0)
    return {
      status: 'not_OK',
      summary: 'No PoE',
      poeType: '',
      openVoltage: 0,
      loadVoltage: 0,
      polarity: '',
      adc: [],
      pairVoltages: [],
    };
  const openVoltage = Math.round(rawOpenVoltage / 10);
  const loadVoltage = Math.round(view.getInt16(6, true) / 10);
  // APK converts the ADC shorts to unsigned values, then computes absolute mode voltages.
  const adc = Array.from({ length: 4 }, (_, index) => view.getUint16(16 + index * 2, true));
  const pairVoltages = Array.from({ length: 4 }, (_, index) =>
    Math.round(view.getInt16(24 + index * 2, true) / 10),
  );
  const modeA = Math.fround(Math.abs(adc[0] - adc[1]) * 0.002393809);
  const modeB = Math.fround(Math.abs(adc[2] - adc[3]) * 0.002393809);
  const polarity: string[] = [];
  if (modeA > 10) polarity.push(adc[1] > adc[0] ? '1-2: - | 3-6: +' : '1-2: + | 3-6: -');
  if (modeB > 10) polarity.push(adc[3] > adc[2] ? '4-5: - | 7-8: +' : '4-5: + | 7-8: -');
  const polarityText = polarity.join(' | ');
  const poeMode = payload[2];
  if (poeMode === 0) {
    return {
      status: 'OK',
      summary: `Passive PoE, O:${openVoltage}V, L: ${loadVoltage}V`,
      poeType: 'Passive / Nonstandard',
      openVoltage,
      loadVoltage,
      polarity: polarityText,
      adc,
      pairVoltages,
    };
  }
  const type =
    poeMode < 80
      ? payload[1] === 4 || payload[0] > 1
        ? 'AT'
        : 'AF/AT'
      : payload[1] > 7 || payload[0] > 4
        ? 'BT'
        : 'AT/BT';
  // APK uses 37 V only for AF/AT; the AT, AT/BT and BT classifications use 42 V.
  const minimumVoltage = type === 'AF/AT' ? 37 : 42;
  const unbalanced = modeA > 10 && modeB > 10 && (Math.abs(modeA - modeB) * 100) / modeA > 10;
  const status = openVoltage < minimumVoltage || loadVoltage < minimumVoltage ? 'not_OK' : 'OK';
  return {
    status,
    summary: `${unbalanced ? 'UB! ' : ''}PoE ${type}, Class: ${payload[1]}, ${loadVoltage}V`,
    poeType: type,
    maxClass: poeClass(payload[1]),
    openVoltage,
    loadVoltage,
    polarity: polarityText,
    adc,
    pairVoltages,
    unbalanced,
  };
}
