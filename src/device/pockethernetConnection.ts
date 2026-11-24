import { createPacketInbox, requestPacket, type PacketWaitOptions } from './packetInbox';
import { isTesterUse, probablyIdleShutdown } from './testerActivity';
import {
  BLE,
  PACKET,
  crc16,
  decodeCobs,
  deviceInfoCommand,
  encodePacket,
  parseDeviceInfo,
  type DeviceInfo,
  type Packet,
} from '@/pockethernetProtocol';

export interface PockethernetState {
  status: 'disconnected' | 'connecting' | 'reconnecting' | 'connected';
  device: string | null;
  info: DeviceInfo | null;
  batteryPercent: number | null;
  batteryCharging?: boolean;
  idleShutdown?: boolean;
  error: string;
}

interface DeviceCommands {
  request: (
    command: Packet,
    types: number | number[],
    timeout?: number,
    options?: PacketWaitOptions,
  ) => Promise<Packet>;
  send: (command: Packet) => Promise<void>;
  waitFor: (
    types: number | number[],
    timeout?: number,
    options?: PacketWaitOptions,
  ) => Promise<Packet>;
  collectFor: (type: number, timeout?: number, options?: PacketWaitOptions) => Promise<Packet[]>;
}

export interface PockethernetClient extends PockethernetState, DeviceCommands {
  clearError: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export interface ConnectionSnapshot extends PockethernetState {
  commands: DeviceCommands | null;
}

export const INITIAL_CONNECTION: ConnectionSnapshot = {
  status: 'disconnected',
  device: null,
  info: null,
  batteryPercent: null,
  batteryCharging: false,
  idleShutdown: false,
  error: '',
  commands: null,
};

const RETRY_DELAYS_MS = [350, 900, 1800];
const RETRY_ATTEMPT_TIMEOUT_MS = 7000;

interface Link {
  device: BluetoothDevice;
  gatt: BluetoothRemoteGATTServer;
  notify: BluetoothRemoteGATTCharacteristic | null;
  write: BluetoothRemoteGATTCharacteristic | null;
  commands: DeviceCommands;
  inbox: ReturnType<typeof createPacketInbox>;
  abort: AbortController;
  info: DeviceInfo | null;
  lastUseAt: number | null;
  onNotification: () => void;
  onDisconnect: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unavailable(): Promise<never> {
  return Promise.reject(new Error('Pockethernet is not connected'));
}

function disconnectGatt(gatt: BluetoothRemoteGATTServer): void {
  try {
    gatt.disconnect();
  } catch {
    // The adapter may already have released the GATT server.
  }
}

async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => {
      const reason: unknown = signal.reason;
      reject(reason instanceof Error ? reason : new Error('Bluetooth operation cancelled.'));
    };
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([work, cancelled]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

async function delay(ms: number, signal: AbortSignal): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await abortable(
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      }),
      signal,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function createPockethernetConnection(
  publish: (snapshot: ConnectionSnapshot) => void,
  selectDevice = async (): Promise<BluetoothDevice> => {
    if (!Reflect.has(navigator, 'bluetooth'))
      throw new Error('Web Bluetooth needs desktop Chrome or Edge and localhost/HTTPS.');
    return navigator.bluetooth.requestDevice({ filters: [{ services: [BLE.service] }] });
  },
): {
  connect: () => Promise<void>;
  disconnect: () => void;
  close: () => void;
  clearError: () => void;
  setAutoReconnect: (enabled: boolean) => void;
  commands: DeviceCommands;
  isBusy: () => boolean;
  setBattery: (
    request: DeviceCommands['request'],
    percent: number | null,
    charging: boolean,
  ) => void;
} {
  let state = INITIAL_CONNECTION;
  let currentLink: Link | null = null;
  let operation: { controller: AbortController; retrying: boolean } | null = null;
  let autoReconnect = true;
  const update = (patch: Partial<ConnectionSnapshot>) => {
    state = { ...state, ...patch };
    publish(state);
  };
  // A caller can connect and issue a request before React publishes the new snapshot.
  const commands: DeviceCommands = {
    send: (...args) => state.commands?.send(...args) ?? unavailable(),
    request: (...args) => state.commands?.request(...args) ?? unavailable(),
    waitFor: (...args) => state.commands?.waitFor(...args) ?? unavailable(),
    collectFor: (...args) => state.commands?.collectFor(...args) ?? unavailable(),
  };

  function releaseLink(): void {
    const link = currentLink;
    if (!link) return;
    currentLink = null;
    link.abort.abort(new Error('Pockethernet disconnected'));
    link.inbox.cancel();
    link.notify?.removeEventListener('characteristicvaluechanged', link.onNotification);
    link.device.removeEventListener('gattserverdisconnected', link.onDisconnect);
    // Also cancel a native connect that may still be pending after a timeout.
    disconnectGatt(link.gatt);
  }

  function close(): void {
    operation?.controller.abort();
    operation = null;
    releaseLink();
    state = INITIAL_CONNECTION;
  }

  function disconnect(): void {
    close();
    publish(state);
  }

  async function reconnect(device: BluetoothDevice, idleShutdown: boolean): Promise<void> {
    const attempt = { controller: new AbortController(), retrying: true };
    operation = attempt;
    const { signal } = attempt.controller;
    update({
      ...INITIAL_CONNECTION,
      status: 'reconnecting',
      device: device.name ?? 'Pockethernet 2',
    });
    try {
      for (const wait of RETRY_DELAYS_MS) {
        await delay(wait, signal);
        try {
          await openLink(
            device,
            AbortSignal.any([signal, AbortSignal.timeout(RETRY_ATTEMPT_TIMEOUT_MS)]),
          );
          return;
        } catch {
          signal.throwIfAborted();
        }
      }
      update({
        ...INITIAL_CONNECTION,
        idleShutdown,
        error: idleShutdown ? '' : 'Bluetooth connection lost. Select Connect to try again.',
      });
    } catch (error) {
      if (!signal.aborted) update({ ...INITIAL_CONNECTION, error: errorMessage(error) });
    } finally {
      if (operation === attempt) operation = null;
    }
  }

  async function openLink(device: BluetoothDevice, parentSignal: AbortSignal): Promise<void> {
    const gatt = device.gatt;
    if (!gatt) throw new Error('The selected device does not support Bluetooth GATT');
    parentSignal.throwIfAborted();
    const abort = new AbortController();
    const signal = AbortSignal.any([parentSignal, abort.signal]);
    const inbox = createPacketInbox();
    let writes = Promise.resolve();
    const chunks: number[] = [];
    const isCurrent = () => currentLink === link;
    const link: Link = {
      device,
      gatt,
      abort,
      inbox,
      notify: null,
      write: null,
      info: null,
      lastUseAt: null,
      commands: {
        send(command) {
          const characteristic = link.write;
          if (!characteristic || !isCurrent()) return unavailable();
          const write = writes.then(async () => {
            if (!isCurrent()) throw new Error('Pockethernet disconnected');
            const frame = encodePacket(command.type, command.payload);
            if (isTesterUse(command.type)) link.lastUseAt = Date.now();
            for (let offset = 0; offset < frame.length; offset += 20) {
              if (!isCurrent()) throw new Error('Pockethernet disconnected');
              await characteristic.writeValueWithResponse(
                new Uint8Array(frame.slice(offset, offset + 20)),
              );
            }
          });
          writes = write.catch(() => undefined);
          return abortable(write, abort.signal);
        },
        request: (...args) =>
          isCurrent() ? requestPacket(inbox, link.commands.send, ...args) : unavailable(),
        waitFor: (...args) => (isCurrent() ? inbox.waitFor(...args) : unavailable()),
        collectFor: (...args) => (isCurrent() ? inbox.collectFor(...args) : unavailable()),
      },
      onNotification() {
        const value = link.notify?.value;
        if (!isCurrent() || !value) return;
        const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        for (const byte of bytes) {
          if (byte !== 0) {
            chunks.push(byte);
            continue;
          }
          if (!chunks.length) continue;
          try {
            const raw = decodeCobs(Uint8Array.from(chunks));
            const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
            const receivedCrc = view.getUint16(2, true);
            raw[2] = raw[3] = 0;
            if (receivedCrc === crc16(raw))
              inbox.receive({ type: view.getUint16(0, true), payload: raw.slice(4) });
          } catch (error) {
            update({ error: errorMessage(error) });
          }
          chunks.length = 0;
        }
      },
      onDisconnect() {
        if (!isCurrent() || gatt.connected) return;
        const info = link.info;
        const idleShutdown = probablyIdleShutdown(info?.espVersion, link.lastUseAt, Date.now());
        releaseLink();
        if (!info) return; // An unfinished handshake is handled by its caller.
        if (autoReconnect) void reconnect(device, idleShutdown);
        else update(INITIAL_CONNECTION);
      },
    };
    currentLink = link;
    device.addEventListener('gattserverdisconnected', link.onDisconnect);
    const handshake = async () => {
      const server = await gatt.connect();
      // Some adapters finish a native connect after cancellation. Close it if no
      // newer attempt for this device owns the server.
      if (signal.aborted && currentLink?.device.id !== device.id) disconnectGatt(server);
      signal.throwIfAborted();
      const service = await server.getPrimaryService(BLE.service);
      signal.throwIfAborted();
      const notify = await service.getCharacteristic(BLE.notify);
      signal.throwIfAborted();
      const write = await service.getCharacteristic(BLE.write);
      signal.throwIfAborted();
      link.notify = notify;
      link.write = write;
      notify.addEventListener('characteristicvaluechanged', link.onNotification);
      await notify.startNotifications();
      signal.throwIfAborted();
      const response = await link.commands.request(deviceInfoCommand(), PACKET.DEVICE_INFO, 3500, {
        signal,
      });
      signal.throwIfAborted();
      return parseDeviceInfo(response.payload);
    };
    try {
      const info = await abortable(handshake(), signal);
      signal.throwIfAborted();
      link.info = info;
      link.lastUseAt = Date.now();
      update({
        ...INITIAL_CONNECTION,
        status: 'connected',
        device: device.name ?? 'Pockethernet 2',
        info,
        commands: link.commands,
      });
    } catch (error) {
      if (isCurrent()) releaseLink();
      throw error;
    }
  }

  return {
    async connect() {
      if (operation || currentLink)
        throw new Error('Pockethernet already has a connection in progress.');
      const attempt = { controller: new AbortController(), retrying: false };
      operation = attempt;
      const { signal } = attempt.controller;
      update({ ...INITIAL_CONNECTION, status: 'connecting' });
      try {
        const device = await selectDevice();
        signal.throwIfAborted();
        await openLink(device, signal);
      } catch (error) {
        if (signal.aborted) return;
        update({ ...INITIAL_CONNECTION, error: errorMessage(error) });
        throw error;
      } finally {
        if (operation === attempt) operation = null;
      }
    },
    disconnect,
    close,
    clearError: () => update({ error: '', idleShutdown: false }),
    setAutoReconnect(enabled) {
      autoReconnect = enabled;
      if (!enabled && operation?.retrying) disconnect();
    },
    commands,
    isBusy: () => currentLink?.inbox.busy ?? false,
    setBattery(request, batteryPercent, batteryCharging) {
      if (state.commands?.request === request) update({ batteryPercent, batteryCharging });
    },
  };
}
