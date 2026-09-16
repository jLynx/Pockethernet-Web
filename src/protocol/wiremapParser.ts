import type { BasicResult, ResultStatus, WiremapResult } from './types';

const WIREMAP = Object.freeze({
  resistanceMin: 12000,
  resistanceMax: 1000000,
  shortMax: 100,
  tolerance: 0.037,
  idTolerance: 0.045,
  v1Signatures: [22000, 18000, 27000, 15000, 91000, 48000, 113000, 130000, 148000],
  v2Signatures: [
    100000, 150000, 180000, 220000, 270000, 300000, 330000, 370000, 420000, 430000, 480000, 520000,
    600000, 700000,
  ],
  v2Search: [
    0, 0, 0, 100000, 270000, 420000, 100000, 370000, 520000, 150000, 270000, 370000, 180000, 300000,
    520000, 180000, 480000, 700000, 150000, 420000, 520000, 220000, 300000, 480000, 220000, 520000,
    700000, 330000, 430000, 600000,
  ],
});

function matches(reference: number, tolerance: number, value: number): boolean {
  return value >= reference * (1 - tolerance) && value <= reference * (1 + tolerance);
}

function wiremapResistance(values: number[], wire1: number, wire2: number): number {
  if (wire1 > wire2) [wire1, wire2] = [wire2, wire1];
  if (wire1 === wire2 || wire1 < 1 || wire2 > 9) return 0;
  return values[[0, 8, 15, 21, 26, 30, 33, 35][wire1 - 1] + wire2 - wire1 - 1];
}

function detectWiremapAdapter(values: number[]): 0 | 1 | 2 {
  let v1 = 0;
  let v1Low = 0;
  let v2 = 0;
  for (const value of values) {
    if (value <= WIREMAP.resistanceMin || value >= WIREMAP.resistanceMax) continue;
    if (WIREMAP.v1Signatures.some((signature) => matches(signature, WIREMAP.tolerance, value))) {
      v1 += 1;
      if (value < 100000) v1Low += 1;
    }
    if (WIREMAP.v2Signatures.some((signature) => matches(signature, WIREMAP.tolerance, value)))
      v2 += 1;
  }
  if (v1Low > 0) return 1;
  if (v1 === 0 && v2 === 0) return 0;
  return v2 > v1 ? 2 : 1;
}

function matchV1Wire(value: number, sum1: number, sum2: number): number {
  const signatures: [number, number, number][] = [
    [22000, 1, 2],
    [18000, 3, 6],
    [27000, 4, 5],
    [15000, 7, 8],
    [91000, 9, 2],
    [48000, 7, 5],
    [113000, 9, 1],
    [130000, 9, 6],
    [148000, 9, 3],
  ];
  const match = signatures.find(([signature]) => matches(signature, WIREMAP.tolerance, value));
  if (!match) return 0;
  const [, wire1, wire2] = match;
  if (sum1 === sum2) return wire1 * 10 + wire2;
  return sum1 > sum2 ? wire1 : wire2;
}

function detectV2Connections(values: number[], connections: number[], shorts: number[]): void {
  if (shorts.some((wire) => wire !== 0)) return;
  for (const [signatureA, signatureB] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ]) {
    for (let input = 1; input <= 9; input += 1) {
      if (connections[input] !== 0) continue;
      for (let output = 1; output <= 9; output += 1) {
        const targetA = WIREMAP.v2Search[output * 3 + signatureA];
        const targetB = WIREMAP.v2Search[output * 3 + signatureB];
        let matchA = 0;
        let matchB = 0;
        for (let other = 1; other <= 8; other += 1) {
          if (other === input) continue;
          const value = wiremapResistance(values, input, other);
          if (matches(targetA, WIREMAP.tolerance, value)) matchA = other;
          if (matches(targetB, WIREMAP.tolerance, value)) matchB = other;
        }
        if (matchA && matchB) {
          connections[input] = output;
          break;
        }
      }
    }
  }
}

function wiremapId(value: number): number {
  return (
    [169000, 187000, 205000, 226000, 249000, 274000, 301000, 332000].findIndex((signature) =>
      matches(signature, WIREMAP.idTolerance, value),
    ) + 1 || -1
  );
}

function classifyWiremap(connections: number[], shorts: number[]): BasicResult {
  if (shorts.slice(1).some(Boolean)) return { status: 'not_OK', summary: 'Short circuit' };
  if (!connections.slice(1).some(Boolean))
    return { status: 'not_OK', summary: 'Cable open / No wiremap adapter' };
  if ([1, 2, 3, 4, 5, 6, 7, 8].every((wire) => connections[wire] === 9 - wire)) {
    return { status: 'OK', summary: connections[9] === 9 ? 'Rollover (S)' : 'Rollover' };
  }
  let pair12 = 0;
  if (connections[1] === 1 && connections[2] === 2 && connections[3] === 3 && connections[6] === 6)
    pair12 = 1;
  if (connections[1] === 3 && connections[2] === 6 && connections[3] === 1 && connections[6] === 2)
    pair12 = 2;
  let pair45 = 0;
  if (connections[4] === 4 && connections[5] === 5 && connections[7] === 7 && connections[8] === 8)
    pair45 = 1;
  if (connections[4] === 7 && connections[5] === 8 && connections[7] === 4 && connections[8] === 5)
    pair45 = 2;
  if ([4, 5, 7, 8].every((wire) => connections[wire] === 0)) pair45 = 3;
  let summary = 'Miswire';
  let status: ResultStatus = 'OK';
  if (pair45 === 3 && pair12 === 1) summary = '2-pair straight';
  else if (pair45 === 3 && pair12 === 2) summary = '2-pair crossover';
  else if (pair45 === 1 && pair12 === 1) summary = '4-pair straight';
  else if (pair45 === 1 && pair12 === 2) summary = '4-pair mixed crossover';
  else if (pair45 === 2 && pair12 === 2) summary = '4-pair full crossover';
  else status = 'not_OK';
  if (connections[9] === 9) summary += ' (S)';
  return { status, summary };
}

export function parseWiremapPacket(payload: Uint8Array): WiremapResult {
  if (payload.length !== 144)
    throw new Error(`Invalid Wiremap response: expected 144 bytes, received ${payload.length}`);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const values = Array.from({ length: 36 }, (_, index) => view.getInt32(index * 4, true));
  const adapterType = detectWiremapAdapter(values);
  const connections = Array<number>(10).fill(0);
  const shorts = Array<number>(10).fill(0);
  const resistanceSums = Array<number>(10).fill(0);
  for (let wire = 1; wire <= 9; wire += 1) {
    for (let other = 1; other <= 9; other += 1) {
      if (wire === other) continue;
      const resistance = wiremapResistance(values, wire, other);
      if (resistance >= 0 && resistance < WIREMAP.shortMax) shorts[wire] = other;
      if (resistance > WIREMAP.resistanceMin && resistance < WIREMAP.resistanceMax)
        resistanceSums[wire] += resistance;
    }
  }
  if (adapterType === 2) detectV2Connections(values, connections, shorts);
  else {
    for (let wire = 1; wire <= 9; wire += 1) {
      for (let other = 1; other <= 9; other += 1) {
        if (wire === other || (connections[wire] > 0 && connections[wire] < 10)) continue;
        const resistance = wiremapResistance(values, wire, other);
        if (resistance < WIREMAP.resistanceMin) continue;
        const match = matchV1Wire(resistance, resistanceSums[wire], resistanceSums[other]);
        if (match > 0) connections[wire] = match;
      }
    }
  }
  let id = 0;
  if (adapterType === 1) {
    let wire5 = connections.indexOf(5);
    let wire6 = connections.indexOf(6);
    if (wire5 < 1) wire5 = 5;
    if (wire6 < 1) wire6 = 6;
    id = wiremapId(wiremapResistance(values, wire5, wire6));
  }
  for (let wire = 1; wire <= 9; wire += 1) {
    if (connections[wire] !== 0) continue;
    for (let other = 1; other <= 9; other += 1) {
      if (wire === other) continue;
      const resistance = wiremapResistance(values, wire, other);
      if (resistance > WIREMAP.resistanceMin && resistance < WIREMAP.resistanceMax) {
        connections[wire] = 255;
        break;
      }
    }
  }
  return { connections, shorts, id, adapterType, ...classifyWiremap(connections, shorts) };
}
