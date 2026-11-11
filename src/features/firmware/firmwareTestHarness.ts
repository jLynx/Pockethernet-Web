import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { mock } from 'node:test';
import { createPacketInbox, requestPacket } from '@/device/packetInbox';
import type { PockethernetClient } from '@/device/usePockethernet';
import { dhcpPayload, linkPacket } from '@/app/measurementFixtures';
import { PACKET, parseDeviceInfo, type Packet } from '@/pockethernetProtocol';
import { createFirmwareUpdater } from './firmwareUpdateController';
import { readPendingUpdate } from './updateRecovery';
import type { uploadOtaFile } from './uploadOtaFile';

export const url = 'https://ota.pockethernet.com/pen_e_crypt_17.bin';
export const latest = `17#${url}`;
export function infoPayload(esp = 16, stm = 17, serial = 104716): Packet['payload'] {
  const payload = new Uint8Array(35);
  const view = new DataView(payload.buffer);
  view.setUint32(0, serial, true);
  view.setUint32(4, 2, true);
  view.setUint32(12, stm, true);
  view.setUint32(24, esp, true);
  payload.set([0xf4, 0x65, 0x0b, 0xa3, 0x2c, 0xa0], 29);
  return payload;
}
export function statusPacket(status: number): Packet {
  const payload = new Uint8Array(4);
  new DataView(payload.buffer).setUint32(0, status, true);
  return { type: PACKET.ESP_UPDATE, payload };
}
export interface FirmwareHarness {
  client: PockethernetClient;
  updater: ReturnType<typeof createFirmwareUpdater>;
  inbox: ReturnType<typeof createPacketInbox>;
  commands: { packet: Packet; at: number }[];
  memory: Map<string, string>;
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
  locks: boolean[];
  defaultRespond: (command: Packet) => void;
  setResponder: (handler: (command: Packet) => void) => void;
  setInfo: (esp: number, stm?: number, serial?: number) => void;
  block: () => void;
}
export function harness(status = 10, uploadFile?: typeof uploadOtaFile): FirmwareHarness {
  const inbox = createPacketInbox();
  const commands: { packet: Packet; at: number }[] = [];
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string): string | null => memory.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      memory.set(key, value);
    },
    removeItem: (key: string): void => {
      memory.delete(key);
    },
  };
  let currentInfo = infoPayload();
  const notify = (type: number, payload: Packet['payload'] = new Uint8Array()): void =>
    inbox.receive({ type, payload });
  const defaultRespond = (command: Packet): void => {
    if (command.type === PACKET.DEVICE_INFO) notify(command.type, currentInfo);
    else if (command.type === PACKET.ETH_CONFIG) {
      // Cover reverse/early ordering, including link-down noise before the actual link.
      notify(PACKET.DHCPV4_ACK, dhcpPayload());
      inbox.receive(linkPacket(false));
      inbox.receive(linkPacket());
      notify(PACKET.ACK);
    } else if (command.type === PACKET.ESP_UPDATE) {
      assert.ok(readPendingUpdate(storage), 'Recovery marker must precede the flash command');
      inbox.receive(statusPacket(status));
    } else if (command.type === PACKET.ETH_STOP) notify(PACKET.ACK);
    else throw new Error(`Unexpected command ${command.type}`);
  };
  let responder = defaultRespond;
  const send = (packet: Packet): Promise<void> => {
    commands.push({ packet, at: Date.now() });
    responder(packet);
    return Promise.resolve();
  };
  const client: PockethernetClient = {
    status: 'connected',
    device: 'Offline test',
    info: parseDeviceInfo(currentInfo),
    batteryPercent: 80,
    error: '',
    clearError: () => {},
    disconnect: () => {},
    connect: () => {
      client.status = 'connected';
      return Promise.resolve();
    },
    request: (command, types, timeout, options) =>
      requestPacket(inbox, send, command, types, timeout, options),
    send,
    waitFor: inbox.waitFor,
    collectFor: inbox.collectFor,
  };
  let blockedReason = '';
  const locks: boolean[] = [];
  const updater = createFirmwareUpdater({
    getClient: () => client,
    getBlockedReason: () => blockedReason,
    storage,
    onLockChange: (value) => locks.push(value),
    fetchLatest: () => Promise.resolve(new Response(latest)),
    uploadFile,
  });
  return {
    client,
    updater,
    inbox,
    commands,
    storage,
    memory,
    locks,
    defaultRespond,
    setResponder: (fn: typeof responder) => {
      responder = fn;
    },
    setInfo: (esp: number, stm = 17, serial = 104716) => {
      currentInfo = infoPayload(esp, stm, serial);
    },
    block: () => {
      blockedReason = 'Wait for measurements to finish.';
    },
  };
}
export async function clocked(action: () => Promise<void>): Promise<void> {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1800000000000 });
  try {
    await action();
  } finally {
    mock.timers.reset();
  }
}
export async function finish(action: Promise<void>): Promise<void> {
  let finished = false;
  const result = action.finally(() => {
    finished = true;
  });
  for (let i = 0; i < 400 && !finished; i++) {
    await setImmediate();
    mock.timers.tick(1000);
  }
  assert.ok(finished, 'Update did not finish within its protocol deadlines');
  await result;
}
export async function install(h: ReturnType<typeof harness>): Promise<void> {
  await h.updater.check();
  h.updater.confirm();
  assert.equal(h.updater.getState().phase, 'confirm');
  await finish(h.updater.start());
  assert.equal(h.inbox.busy, false, 'Transport listeners leaked');
  assert.ok(
    h.commands.every(({ packet }) => packet.type !== 0xf400),
    'STM update must never be sent',
  );
}
