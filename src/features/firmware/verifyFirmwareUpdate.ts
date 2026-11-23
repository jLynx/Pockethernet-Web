import type { DeviceInfo } from '@/pockethernetProtocol';
import { sameDevice } from './runFirmwareUpdate';
import type { PendingUpdate } from './updateRecovery';

export function verifyInstalledFirmware(
  info: DeviceInfo,
  pending: PendingUpdate,
): { phase: 'verified' | 'unconfirmed' | 'failed' | 'unknown'; message: string } {
  const { device, target, completed } = pending;
  if (!sameDevice(info, device))
    throw new Error('This is a different device. Reconnect the Pockethernet that was updated.');
  const version = target.latestVersion;
  if (target.method === 'usb') {
    if (info.espVersion === version && info.stmVersion === version)
      return {
        phase: 'verified',
        message: `Update verified. Pockethernet is running firmware V${version}.`,
      };
    if (info.espVersion === device.espVersion && info.stmVersion === device.stmVersion)
      return {
        phase: 'failed',
        message: `Pockethernet is still running ${info.espVersion}.${info.stmVersion}. Check for updates to try again.`,
      };
    return {
      phase: 'unknown',
      message: `Pockethernet reports firmware ${info.espVersion}.${info.stmVersion}. Expected ${version}.${version}. Restart and verify again, or retry the USB update.`,
    };
  }
  if (info.stmVersion !== device.stmVersion)
    throw new Error(
      'The STM firmware version changed unexpectedly. Update verification needs investigation.',
    );
  if (info.espVersion === version && version === device.espVersion)
    return {
      phase: completed ? 'verified' : 'unconfirmed',
      message: completed
        ? `ESP v${version} confirmed after your restart. Both builds report this version, so build identity cannot be verified from the version number. STM remains v${info.stmVersion}.`
        : `ESP v${version} is running after your restart. Both builds report this version and the OTA result was not received, so installation could not be confirmed.`,
    };
  if (info.espVersion === version)
    return {
      phase: 'verified',
      message: `Update verified: Pockethernet is running ESP v${version}. STM firmware remains v${info.stmVersion}.`,
    };
  if (!completed && info.espVersion === device.espVersion)
    return {
      phase: 'failed',
      message: `After restarting, Pockethernet is still running ESP v${info.espVersion}. The update was not applied. Check for updates to try again.`,
    };
  throw new Error(
    `Pockethernet is running ESP v${info.espVersion}; expected v${version}. Fully turn it off and on, then verify again.`,
  );
}
