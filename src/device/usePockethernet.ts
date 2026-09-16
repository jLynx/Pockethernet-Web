import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BLE,
  PACKET,
  deviceInfoCommand,
  encodePacket,
  parseDeviceInfo,
  type DeviceInfo,
  type Packet,
} from '@/pockethernetProtocol';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface PockethernetState {
  status: ConnectionStatus;
  device: string | null;
  info: DeviceInfo | null;
  error: string;
}

export interface PockethernetClient extends PockethernetState {
  connect: () => Promise<void>;
  disconnect: () => void;
  request: (command: Packet, types: number | number[], timeout?: number) => Promise<Packet>;
  send: (command: Packet) => Promise<void>;
  waitFor: (types: number | number[], timeout?: number) => Promise<Packet>;
  collectFor: (type: number, timeout?: number) => Promise<Packet[]>;
}

interface PacketWaiter {
  types: number[];
  resolve: (packet: Packet) => void;
  reject: (reason: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

interface PacketCollector {
  type: number;
  packets: Packet[];
}

interface BluetoothRefs {
  device: BluetoothDevice | null;
  notify: BluetoothRemoteGATTCharacteristic | null;
  write: BluetoothRemoteGATTCharacteristic | null;
  chunks: number[];
  waiters: PacketWaiter[];
  collectors: PacketCollector[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function decodeCobs(input: Uint8Array): Uint8Array {
  const output = new Uint8Array(input.length);
  let r = 0,
    w = 0;
  while (r < input.length) {
    const code = input[r++];
    if (!code || r + code - 1 > input.length) throw new Error('Invalid COBS data');
    for (let i = 1; i < code; i++) output[w++] = input[r++];
    if (code !== 255 && r < input.length) output[w++] = 0;
  }
  return output.slice(0, w);
}

export function usePockethernet(): PockethernetClient {
  const [state, setState] = useState<PockethernetState>({
    status: 'disconnected',
    device: null,
    info: null,
    error: '',
  });
  const refs = useRef<BluetoothRefs>({
    device: null,
    notify: null,
    write: null,
    chunks: [],
    waiters: [],
    collectors: [],
  });
  const update = useCallback(
    (patch: Partial<PockethernetState>) => setState((current) => ({ ...current, ...patch })),
    [],
  );

  const onPacket = useCallback((packet: Packet) => {
    refs.current.collectors
      .filter((item) => item.type === packet.type)
      .forEach((item) => item.packets.push(packet));
    const waiter = refs.current.waiters.find(
      (item) => item.types.includes(packet.type) || packet.type === PACKET.NACK,
    );
    if (waiter) {
      if (waiter.timer) clearTimeout(waiter.timer);
      refs.current.waiters = refs.current.waiters.filter((item) => item !== waiter);
      if (packet.type === PACKET.NACK) waiter.reject(new Error('Device rejected the request'));
      else waiter.resolve(packet);
    }
  }, []);

  const onNotification = useCallback(() => {
    const characteristic = refs.current.notify;
    if (!characteristic?.value) return;
    const bytes = new Uint8Array(
      characteristic.value.buffer,
      characteristic.value.byteOffset,
      characteristic.value.byteLength,
    );
    const ref = refs.current;
    for (const byte of bytes) {
      if (byte !== 0) {
        ref.chunks.push(byte);
        continue;
      }
      if (!ref.chunks.length) continue;
      try {
        const raw = decodeCobs(Uint8Array.from(ref.chunks));
        const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        const receivedCrc = view.getUint16(2, true);
        raw[2] = raw[3] = 0;
        if (raw.length >= 4 && receivedCrc === crc16(raw))
          onPacket({ type: view.getUint16(0, true), payload: raw.slice(4) });
      } catch (error) {
        update({ error: errorMessage(error) });
      }
      ref.chunks = [];
    }
  }, [onPacket, update]);

  const send = useCallback(async (command: Packet): Promise<void> => {
    const characteristic = refs.current.write;
    if (!characteristic) throw new Error('Pockethernet is not connected');
    const frame = encodePacket(command.type, command.payload);
    for (let offset = 0; offset < frame.length; offset += 20) {
      const chunk = frame.slice(offset, offset + 20);
      await characteristic.writeValueWithResponse(new Uint8Array(chunk));
    }
  }, []);

  const waitFor = useCallback(
    (types: number | number[], timeout = 5000): Promise<Packet> =>
      new Promise<Packet>((resolve, reject) => {
        const waiter: PacketWaiter = {
          types: Array.isArray(types) ? types : [types],
          resolve,
          reject,
        };
        waiter.timer = setTimeout(() => {
          refs.current.waiters = refs.current.waiters.filter((item) => item !== waiter);
          reject(new Error('The device did not respond in time'));
        }, timeout);
        refs.current.waiters.push(waiter);
      }),
    [],
  );

  const collectFor = useCallback(
    (type: number, timeout = 5000): Promise<Packet[]> =>
      new Promise<Packet[]>((resolve) => {
        const collector: PacketCollector = { type, packets: [] };
        refs.current.collectors.push(collector);
        setTimeout(() => {
          refs.current.collectors = refs.current.collectors.filter((item) => item !== collector);
          resolve(collector.packets);
        }, timeout);
      }),
    [],
  );

  const request = useCallback(
    async (command: Packet, types: number | number[], timeout = 5000): Promise<Packet> => {
      const reply = waitFor(types, timeout);
      await send(command);
      return reply;
    },
    [send, waitFor],
  );

  const disconnect = useCallback(() => {
    const { device } = refs.current;
    if (device?.gatt?.connected) device.gatt.disconnect();
    refs.current = {
      device: null,
      notify: null,
      write: null,
      chunks: [],
      waiters: [],
      collectors: [],
    };
    update({ status: 'disconnected', device: null, info: null });
  }, [update]);

  const connect = useCallback(async () => {
    if (!Reflect.has(navigator, 'bluetooth'))
      throw new Error('Web Bluetooth needs desktop Chrome or Edge and localhost/HTTPS.');
    update({ status: 'connecting', error: '' });
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE.service] }],
      });
      device.addEventListener('gattserverdisconnected', disconnect, { once: true });
      if (!device.gatt) throw new Error('The selected device does not support Bluetooth GATT');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE.service);
      const notify = await service.getCharacteristic(BLE.notify);
      const write = await service.getCharacteristic(BLE.write);
      refs.current = { ...refs.current, device, notify, write };
      notify.addEventListener('characteristicvaluechanged', onNotification);
      await notify.startNotifications();
      update({ status: 'connected', device: device.name ?? 'Pockethernet 2' });
      const response = await request(deviceInfoCommand(), PACKET.DEVICE_INFO, 3500);
      update({ info: parseDeviceInfo(response.payload) });
    } catch (error) {
      update({ status: 'disconnected', error: errorMessage(error) });
      throw error;
    }
  }, [disconnect, onNotification, request, update]);

  useEffect(
    () => () => {
      if (refs.current.device?.gatt?.connected) refs.current.device.gatt.disconnect();
    },
    [],
  );
  return { ...state, connect, disconnect, request, send, waitFor, collectFor };
}

function crc16(data: Uint8Array): number {
  let crc = 0xffff;
  for (const value of data) {
    let x = ((crc >>> 8) ^ value) & 255;
    x ^= x >>> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 65535;
  }
  return crc;
}
