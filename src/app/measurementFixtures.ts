// Deterministic packet fixtures for offline orchestration tests, not device captures.
import { PACKET, type Packet } from '@/pockethernetProtocol';

export function samples(values: number[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(values.length * 2);
  const view = new DataView(result.buffer);
  values.forEach((value, index) =>
    view.setUint16(index * 2, Math.abs(value) | (value < 0 ? 0x100 : 0), true),
  );
  return result;
}
export const tdrPayload = samples(
  Array.from({ length: 4 }, () => [...Array<number>(40).fill(0), 1, 5, 20, 5, 0]).flat(),
);
export const crossPayload = samples(Array.from({ length: 6 }, () => [1, 2, 3, 4]).flat());
export const trafficPayload = Uint8Array.of(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 8, 0);
export const lldpPayload = Uint8Array.of(
  1,
  0x80,
  0xc2,
  0,
  0,
  14,
  ...trafficPayload.slice(6, 12),
  0x88,
  0xcc,
  10,
  3,
  115,
  119,
  49,
  0,
  0,
);

export function linkPacket(up = true): Packet {
  const payload = new Uint8Array(30);
  new DataView(payload.buffer).setUint16(10, up ? 64 | 128 | 512 : 0, true);
  return { type: PACKET.PHY_LINKINFO, payload };
}

export function dhcpPayload(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(14 + 20 + 8 + 240 + 19);
  bytes.set(trafficPayload);
  bytes[14] = 0x45;
  bytes[23] = 17;
  bytes.set([192, 0, 2, 10], 26);
  bytes.set([192, 0, 2, 20], 42 + 16);
  new DataView(bytes.buffer).setUint32(42 + 236, 0x63825363, false);
  bytes.set([3, 4, 192, 0, 2, 1, 6, 4, 192, 0, 2, 53, 1, 4, 255, 255, 255, 0, 255], 42 + 240);
  return bytes;
}

export function ipv6Payload(protocol: number, data: number[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(54 + data.length);
  bytes.set(trafficPayload.slice(0, 12));
  bytes.set([0x86, 0xdd, 0x60], 12);
  bytes[20] = protocol;
  bytes.set([0x20, 1, 0x0d, 0xb8], 22);
  bytes[37] = 1;
  bytes.set(data, 54);
  return bytes;
}
export const raPayload = ipv6Payload(58, [
  134,
  0,
  0,
  0,
  64,
  0xc0,
  0,
  120,
  ...Array<number>(8).fill(0),
]);
export const dhcpv6Payload = ipv6Payload(17, [
  ...Array<number>(8).fill(0),
  7,
  0,
  0,
  1,
  0,
  23,
  0,
  16,
  0x20,
  1,
  0x0d,
  0xb8,
  ...Array<number>(11).fill(0),
  53,
]);

export function pingPayload(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(16);
  new DataView(bytes.buffer).setUint16(6, 23, true);
  bytes.set([192, 0, 2, 1], 12);
  return bytes;
}
