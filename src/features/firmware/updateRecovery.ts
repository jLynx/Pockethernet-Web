import type { DeviceInfo } from '@/pockethernetProtocol';
import type { FirmwareUpdateTarget } from './updateTarget';

export const UPDATE_RECOVERY_KEY = 'pockethernet.pendingFirmwareUpdate';
export interface PendingUpdate {
  device: DeviceInfo;
  target: FirmwareUpdateTarget;
  startedAt: number;
  completed: boolean;
}
export type UpdateStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** A page reload must never silently clear an update that may be writing flash. */
export function readPendingUpdate(storage: UpdateStorage): PendingUpdate | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(UPDATE_RECOVERY_KEY) ?? 'null');
    if (
      !value ||
      typeof value !== 'object' ||
      !('device' in value) ||
      !('target' in value) ||
      !('startedAt' in value) ||
      typeof value.startedAt !== 'number' ||
      !Number.isFinite(value.startedAt) ||
      !('completed' in value) ||
      typeof value.completed !== 'boolean'
    )
      return null;
    const { device, target } = value;
    if (
      !device ||
      typeof device !== 'object' ||
      !target ||
      typeof target !== 'object' ||
      !('serial' in device) ||
      typeof device.serial !== 'number' ||
      !('mac' in device) ||
      typeof device.mac !== 'string' ||
      !('hardwareVersion' in device) ||
      typeof device.hardwareVersion !== 'number' ||
      !('stmVersion' in device) ||
      typeof device.stmVersion !== 'number' ||
      !('espVersion' in device) ||
      typeof device.espVersion !== 'number' ||
      !('latestVersion' in target) ||
      typeof target.latestVersion !== 'number' ||
      !('downloadUrl' in target) ||
      typeof target.downloadUrl !== 'string'
    )
      return null;
    return {
      device: {
        serial: device.serial,
        mac: device.mac,
        hardwareVersion: device.hardwareVersion,
        stmVersion: device.stmVersion,
        espVersion: device.espVersion,
      },
      target: {
        latestVersion: target.latestVersion,
        downloadUrl: target.downloadUrl,
        updateAvailable: true,
        message: `Update available: v${target.latestVersion}`,
        ...('source' in target &&
        (target.source === 'official' || target.source === 'url' || target.source === 'file')
          ? { source: target.source }
          : {}),
        ...('label' in target && typeof target.label === 'string' ? { label: target.label } : {}),
        ...('sha256' in target && typeof target.sha256 === 'string'
          ? { sha256: target.sha256 }
          : {}),
        ...('bytes' in target && typeof target.bytes === 'number' ? { bytes: target.bytes } : {}),
      },
      startedAt: value.startedAt,
      completed: value.completed,
    };
  } catch {
    return null;
  }
}
