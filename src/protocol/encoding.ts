export function crc16(data: Uint8Array): number {
  let crc = 0xffff;
  for (const value of data) {
    let next = ((crc >>> 8) ^ value) & 0xff;
    next ^= next >>> 4;
    crc = ((crc << 8) ^ (next << 12) ^ (next << 5) ^ next) & 0xffff;
  }
  return crc;
}

export function cobsEncode(input: Uint8Array): Uint8Array {
  const output = new Uint8Array(input.length + Math.ceil(input.length / 254) + 1);
  let read = 0;
  let write = 1;
  let codeIndex = 0;
  let code = 1;
  while (read < input.length) {
    if (input[read] === 0) {
      output[codeIndex] = code;
      code = 1;
      codeIndex = write++;
      read++;
    } else {
      output[write++] = input[read++];
      code++;
      if (code === 0xff) {
        output[codeIndex] = code;
        code = 1;
        codeIndex = write++;
      }
    }
  }
  output[codeIndex] = code;
  return output.slice(0, write);
}

export function encodePacket(type: number, payload = new Uint8Array()): Uint8Array {
  const raw = new Uint8Array(payload.length + 4);
  const view = new DataView(raw.buffer);
  view.setUint16(0, type, true);
  raw.set(payload, 4);
  view.setUint16(2, crc16(raw), true);
  const cobs = cobsEncode(raw);
  const frame = new Uint8Array(cobs.length + 2);
  frame.set(cobs, 1);
  return frame;
}
