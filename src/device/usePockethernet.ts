import { useEffect, useState } from 'react';
import { PACKET, batteryStatusCommand, parseBatteryStatus } from '@/pockethernetProtocol';
import {
  createPockethernetConnection,
  INITIAL_CONNECTION,
  type PockethernetClient,
} from './pockethernetConnection';

export type { PockethernetClient, PockethernetState } from './pockethernetConnection';

export function usePockethernet({
  pollBattery = true,
  autoReconnect = true,
} = {}): PockethernetClient {
  const [snapshot, setSnapshot] = useState(INITIAL_CONNECTION);
  const [controller] = useState(() => createPockethernetConnection(setSnapshot));
  const { commands, ...state } = snapshot;
  const request = commands?.request;

  useEffect(() => controller.close, [controller]);
  useEffect(() => controller.setAutoReconnect(autoReconnect), [controller, autoReconnect]);

  useEffect(() => {
    if (!request || !pollBattery) return;
    const scope = new AbortController();
    let hasBatteryReading = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async (): Promise<void> => {
      if (scope.signal.aborted) return;
      // Leave the transport available for measurements and packet collection.
      if (controller.isBusy()) {
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
        if (!hasBatteryReading && response.payload.every((byte) => byte === 0))
          nextPollDelay = 2000;
      } catch {
        // Older firmware or a missed status response must not break the connection.
      }
      if (scope.signal.aborted) return;
      controller.setBattery(request, percent, charging);
      timer = setTimeout(() => void refresh(), nextPollDelay);
    };
    void refresh();
    return () => {
      scope.abort();
      clearTimeout(timer);
    };
  }, [controller, pollBattery, request]);

  return {
    ...state,
    ...(commands ?? controller.commands),
    connect: controller.connect,
    disconnect: controller.disconnect,
    clearError: controller.clearError,
  };
}
