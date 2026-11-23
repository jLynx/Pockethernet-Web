import { PACKET } from '@/protocol/constants';
import { firmwareSupports } from '@/protocol/firmwareFeatures';

// Match the Android app's one-minute tolerance for the tester's 60-minute timer.
const IDLE_SHUTDOWN_THRESHOLD_MS = 59 * 60 * 1000;

export function isTesterUse(commandType: number): boolean {
  return commandType !== PACKET.BATTERY_STATUS && commandType !== PACKET.DEVICE_INFO;
}

export function probablyIdleShutdown(
  firmwareVersion: number | undefined,
  lastUseAt: number | null,
  now: number,
): boolean {
  return (
    lastUseAt !== null &&
    firmwareSupports(firmwareVersion, 'idleAutoOff') &&
    now - lastUseAt >= IDLE_SHUTDOWN_THRESHOLD_MS
  );
}
