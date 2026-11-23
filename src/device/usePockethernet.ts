import { useCallback, useEffect, useRef, useState } from 'react';
import { createPacketInbox, requestPacket, type PacketWaitOptions } from './packetInbox';
import { isTesterUse, probablyIdleShutdown } from './testerActivity';
import {
  BLE,
  PACKET,
  batteryStatusCommand,
  decodeCobs,
  deviceInfoCommand,
  encodePacket,
  parseDeviceInfo,
  parseBatteryStatus,
  type DeviceInfo,
  type Packet,
} from '@/pockethernetProtocol';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface PockethernetState {
  status: ConnectionStatus;
  device: string | null;
  info: DeviceInfo | null;
  batteryPercent: number | null;
  batteryCharging?: boolean;
  idleShutdown?: boolean;
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
  lastUseAt: number | null;
  firmwareVersion?: number;
  onDisconnect?: () => void;
}

function emptyConnection(): BluetoothRefs {
  return { device: null, notify: null, write: null, chunks: [], lastUseAt: null };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function usePockethernet({ pollBattery = true } = {}): PockethernetClient {
  const [state, setState] = useState<PockethernetState>({
    status: 'disconnected',
    device: null,
    info: null,
    batteryPercent: null,
    error: '',
  });
  const refs = useRef<BluetoothRefs>(emptyConnection());
  const inbox = useRef(createPacketInbox());
  const writes = useRef<Promise<void>>(Promise.resolve());
  const update = useCallback(
    (patch: Partial<PockethernetState>) => setState((current) => ({ ...current, ...patch })),
    [],
  );
  const clearError = useCallback(() => update({ error: '', idleShutdown: false }), [update]);

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
    const connection = refs.current;
    const characteristic = connection.write;
    const write = writes.current.then(async () => {
      if (!characteristic || connection !== refs.current)
        throw new Error('Pockethernet is not connected');
      const frame = encodePacket(command.type, command.payload);
      if (isTesterUse(command.type)) connection.lastUseAt = Date.now();
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

  const disconnectTransport = useCallback(() => {
    const { device, notify, onDisconnect } = refs.current;
    refs.current = emptyConnection();
    inbox.current.cancel();
    notify?.removeEventListener('characteristicvaluechanged', onNotification);
    if (onDisconnect) device?.removeEventListener('gattserverdisconnected', onDisconnect);
    if (device?.gatt?.connected) device.gatt.disconnect();
  }, [onNotification]);

  const finishDisconnect = useCallback(
    (unexpected: boolean) => {
      const { firmwareVersion, lastUseAt } = refs.current;
      disconnectTransport();
      update({
        status: 'disconnected',
        device: null,
        info: null,
        batteryPercent: null,
        batteryCharging: false,
        idleShutdown: unexpected && probablyIdleShutdown(firmwareVersion, lastUseAt, Date.now()),
      });
    },
    [disconnectTransport, update],
  );
  const disconnect = useCallback(() => finishDisconnect(false), [finishDisconnect]);

  const connect = useCallback(async () => {
    if (!Reflect.has(navigator, 'bluetooth'))
      throw new Error('Web Bluetooth needs desktop Chrome or Edge and localhost/HTTPS.');
    update({
      status: 'connecting',
      error: '',
      idleShutdown: false,
      batteryPercent: null,
      batteryCharging: false,
    });
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE.service] }],
      });
      if (!device.gatt) throw new Error('The selected device does not support Bluetooth GATT');
      const connection = {
        ...emptyConnection(),
        device,
        onDisconnect: () => {
          if (refs.current === connection) finishDisconnect(true);
        },
      };
      const assertConnected = () => {
        if (refs.current !== connection)
          throw new Error('Pockethernet disconnected while connecting.');
      };
      refs.current = connection;
      device.addEventListener('gattserverdisconnected', connection.onDisconnect, { once: true });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE.service);
      const notify = await service.getCharacteristic(BLE.notify);
      const write = await service.getCharacteristic(BLE.write);
      assertConnected();
      connection.notify = notify;
      connection.write = write;
      notify.addEventListener('characteristicvaluechanged', onNotification);
      await notify.startNotifications();
      assertConnected();
      connection.lastUseAt = Date.now();
      update({ status: 'connected', device: device.name ?? 'Pockethernet 2' });
      const response = await request(deviceInfoCommand(), PACKET.DEVICE_INFO, 3500);
      assertConnected();
      const info = parseDeviceInfo(response.payload);
      connection.firmwareVersion = info.espVersion;
      update({ info });
    } catch (error) {
      disconnect();
      update({ status: 'disconnected', error: errorMessage(error) });
      throw error;
    }
  }, [disconnect, finishDisconnect, onNotification, request, update]);

  useEffect(() => {
    if (state.status !== 'connected' || !state.info || !pollBattery) return;
    const scope = new AbortController();
    let hasBatteryReading = false;
    let timer: ReturnType<typeof setTimeout>;
    const device = refs.current.device;
    const refresh = async (): Promise<void> => {
      if (scope.signal.aborted || refs.current.device !== device) return;
      // Leave the transport available for measurements and packet collection.
      if (inbox.current.busy) {
        timer = setTimeout(() => void refresh(), 5000);
        return;
      }
      let percent: number | null = null;
      let charging = false;
      let nextPollDelay = 30_000;
      try {
        const response = await request(batteryStatusCommand(), PACKET.BATTERY_STATUS, 3500, {
          signal: scope.signal,
          rejectNack: false,
        });
        const battery = parseBatteryStatus(response.payload);
        percent = battery?.percent ?? null;
        charging = battery?.charging ?? false;
        hasBatteryReading ||= battery !== null;
        // F110 returns zeros until the firmware's first internal STM32 poll.
        // Retry that startup cache promptly; keep failures on the normal interval.
        if (!hasBatteryReading && response.payload.every((byte) => byte === 0))
          nextPollDelay = 2000;
      } catch {
        // Older firmware or a missed status response must not break the connection.
      }
      if (scope.signal.aborted || refs.current.device !== device) return;
      update({ batteryPercent: percent, batteryCharging: charging });
      timer = setTimeout(() => void refresh(), nextPollDelay);
    };
    void refresh();
    return () => {
      scope.abort();
      clearTimeout(timer);
    };
  }, [state.status, state.info, pollBattery, request, update]);

  useEffect(() => disconnectTransport, [disconnectTransport]);
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
