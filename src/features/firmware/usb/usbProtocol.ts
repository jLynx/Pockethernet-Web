import { crc16, decodeCobs, encodePacket } from '@/protocol/encoding';
import type { Packet } from '@/protocol/types';
import { SERIAL_BUFFER_SIZE } from './serial';
import type { UpdaterPort } from './serial';

export const BOOTLOADER_BAUD = 115_200;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeFrame(bytes: number[]): Packet | undefined {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = decodeCobs(Uint8Array.from(bytes));
  } catch {
    return;
  }
  if (raw.length < 4) return;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const checksum = view.getUint16(2, true);
  raw[2] = raw[3] = 0;
  if (crc16(raw) === checksum) return { type: view.getUint16(0, true), payload: raw.subarray(4) };
}

class PacketConnection {
  private frame: number[] | undefined;
  private readonly packets: Packet[] = [];

  constructor(
    private readonly reader: ReadableStreamDefaultReader<Uint8Array>,
    private readonly writer: WritableStreamDefaultWriter<Uint8Array>,
  ) {}

  async send(type: number, payload?: Uint8Array<ArrayBuffer>, padUsbPacket = false): Promise<void> {
    const frame = encodePacket(type, payload);
    if (padUsbPacket && frame.length % 64 === 0) {
      // Terminate transfers that would otherwise end on a full USB packet.
      const padded = new Uint8Array(frame.length + 1);
      padded.set(frame);
      await this.writer.write(padded);
      return;
    }
    await this.writer.write(frame);
  }

  private receive(chunk: Uint8Array) {
    for (const byte of chunk) {
      if (byte === 0) {
        const packet = this.frame?.length ? decodeFrame(this.frame) : undefined;
        if (packet) this.packets.push(packet);
        this.frame = [];
      } else if (this.frame?.length === SERIAL_BUFFER_SIZE) {
        this.frame = undefined;
      } else {
        this.frame?.push(byte);
      }
    }
  }

  async drain(timeoutMs: number): Promise<void> {
    await this.readMatching(() => false, timeoutMs);
  }

  // Calling code closes the connection after a timeout, canceling the pending read.
  async readMatching(
    match: (packet: Packet) => boolean,
    timeoutMs: number,
  ): Promise<Packet | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    try {
      for (;;) {
        const packet = this.packets.find(match);
        this.packets.length = 0;
        if (packet) return packet;
        const result = await Promise.race([this.reader.read(), timeout]);
        if (!result || result.done) return null;
        this.receive(result.value);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function withSerial<T>(
  port: UpdaterPort,
  baudRate: number,
  run: (connection: PacketConnection) => Promise<T>,
): Promise<T> {
  await port.open({ baudRate, bufferSize: SERIAL_BUFFER_SIZE });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  try {
    reader = port.readable?.getReader();
    writer = port.writable?.getWriter();
    if (!reader || !writer) throw new Error('The Pockethernet USB streams could not be opened.');
    return await run(new PacketConnection(reader, writer));
  } finally {
    writer?.releaseLock();
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
    await port.close().catch(() => {});
  }
}
