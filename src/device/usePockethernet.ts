import { useCallback, useEffect, useRef, useState } from 'react';
import { createPacketInbox, requestPacket, type PacketWaitOptions } from './packetInbox';
import {
  BLE,
  PACKET,
  batteryStatusCommand,
  deviceInfoCommand,
  encodePacket,
  parseDeviceInfo,
  parseBatteryPercent,
  type DeviceInfo,
  type Packet,
} from '@/pockethernetProtocol';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface PockethernetState {
  status: ConnectionStatus;
  device: string | null;
  info: DeviceInfo | null;
  batteryPercent: number | null;
  error: string;
}

export interface PockethernetClient extends PockethernetState {
  clearError: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
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

interface BluetoothRefs {
  device: BluetoothDevice | null;
  notify: BluetoothRemoteGATTCharacteristic | null;
  write: BluetoothRemoteGATTCharacteristic | null;
  chunks: number[];
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

export function usePockethernet({ pollBattery = true } = {}): PockethernetClient {
  const [state, setState] = useState<PockethernetState>({
    status: 'disconnected',
    device: null,
    info: null,
    batteryPercent: null,
    error: '',
  });
  const refs = useRef<BluetoothRefs>({
    device: null,
    notify: null,
    write: null,
    chunks: [],
  });
  const inbox = useRef(createPacketInbox());
  const writes = useRef<Promise<void>>(Promise.resolve());
  const update = useCallback(
    (patch: Partial<PockethernetState>) => setState((current) => ({ ...current, ...patch })),
    [],
  );
  const clearError = useCallback(() => update({ error: '' }), [update]);

  const onPacket = useCallback((packet: Packet) => {
    inbox.current.receive(packet);
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

  const send = useCallback((command: Packet): Promise<void> => {
    const characteristic = refs.current.write;
    const write = writes.current.then(async () => {
      if (!characteristic || characteristic !== refs.current.write)
        throw new Error('Pockethernet is not connected');
      const frame = encodePacket(command.type, command.payload);
      for (let offset = 0; offset < frame.length; offset += 20) {
        const chunk = frame.slice(offset, offset + 20);
        await characteristic.writeValueWithResponse(new Uint8Array(chunk));
      }
    });
    writes.current = write.catch(() => undefined);
    return write;
  }, []);

  const waitFor = useCallback(
    (types: number | number[], timeout = 5000, options?: PacketWaitOptions): Promise<Packet> =>
      inbox.current.waitFor(types, timeout, options),
    [],
  );

  const collectFor = useCallback(
    (type: number, timeout = 5000, options?: PacketWaitOptions): Promise<Packet[]> =>
      inbox.current.collectFor(type, timeout, options),
    [],
  );

  const request = useCallback(
    (
      command: Packet,
      types: number | number[],
      timeout = 5000,
      options?: PacketWaitOptions,
    ): Promise<Packet> => requestPacket(inbox.current, send, command, types, timeout, options),
    [send],
  );

  const disconnect = useCallback(() => {
    const { device } = refs.current;
    inbox.current.cancel();
    refs.current.notify?.removeEventListener('characteristicvaluechanged', onNotification);
    if (device?.gatt?.connected) device.gatt.disconnect();
    refs.current = {
      device: null,
      notify: null,
      write: null,
      chunks: [],
    };
    update({ status: 'disconnected', device: null, info: null, batteryPercent: null });
  }, [onNotification, update]);

  const connect = useCallback(async () => {
    if (!Reflect.has(navigator, 'bluetooth'))
      throw new Error('Web Bluetooth needs desktop Chrome or Edge and localhost/HTTPS.');
    update({ status: 'connecting', error: '', batteryPercent: null });
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
      disconnect();
      update({ status: 'disconnected', error: errorMessage(error) });
      throw error;
    }
  }, [disconnect, onNotification, request, update]);

  useEffect(() => {
    if (state.status !== 'connected' || !state.info || !pollBattery) return;
    let cancelled = false;
    let hasBatteryReading = false;
    let timer: ReturnType<typeof setTimeout>;
    const device = refs.current.device;
    const refresh = async (): Promise<void> => {
      if (cancelled || refs.current.device !== device) return;
      // Leave the transport available for measurements and packet collection.
      if (inbox.current.busy) {
        timer = setTimeout(() => void refresh(), 5000);
        return;
      }
      let percent: number | null = null;
      let nextPollDelay = 30_000;
      try {
        const response = await request(batteryStatusCommand(), PACKET.BATTERY_STATUS, 3500);
        percent = parseBatteryPercent(response.payload);
        hasBatteryReading ||= percent !== null;
        // F110 returns zeros until the firmware's first internal STM32 poll.
        // Retry that startup cache promptly; keep failures on the normal interval.
        if (!hasBatteryReading && response.payload.every((byte) => byte === 0))
          nextPollDelay = 2000;
      } catch {
        // Older firmware or a missed status response must not break the connection.
      }
      if (cancelled || refs.current.device !== device) return;
      update({ batteryPercent: percent });
      timer = setTimeout(() => void refresh(), nextPollDelay);
    };
    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.status, state.info, pollBattery, request, update]);

  useEffect(
    () => () => {
      inbox.current.cancel();
      if (refs.current.device?.gatt?.connected) refs.current.device.gatt.disconnect();
    },
    [],
  );
  return { ...state, clearError, connect, disconnect, request, send, waitFor, collectFor };
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
