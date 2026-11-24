import {
  parseFirmwareVersionResponse,
  validateOfficialFirmwareUrl,
  type DeviceInfo,
} from '@/pockethernetProtocol';
import { loadManifest, type FirmwareManifest } from './usb/firmware';
import type { EthernetUpdateTarget, FirmwareCheck, FirmwareUpdateTarget } from './updateTarget';

export async function loadOfficialUsbManifest(): Promise<FirmwareManifest> {
  return loadManifest(new URL('/api/usb-firmware/manifest.json', window.location.origin));
}

async function loadEthernetRelease(
  currentVersion: number,
  fetchLatest?: () => Promise<Response>,
): Promise<EthernetUpdateTarget> {
  const response = await (fetchLatest?.() ??
    fetch('/api/latest-version', {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    }));
  if (!response.ok) throw new Error(`Update server returned ${response.status}`);
  const result = parseFirmwareVersionResponse(await response.text(), currentVersion);
  validateOfficialFirmwareUrl(result.downloadUrl, result.latestVersion);
  return { ...result, method: 'ethernet' };
}

export async function checkOfficialFirmware(
  device: DeviceInfo,
  loadUsbManifest: typeof loadOfficialUsbManifest,
  fetchLatest?: () => Promise<Response>,
): Promise<FirmwareCheck> {
  const [usb, ethernet] = await Promise.allSettled([
    loadUsbManifest(),
    loadEthernetRelease(device.espVersion, fetchLatest),
  ]);
  const warning =
    usb.status === 'rejected'
      ? 'Could not check for USB updates. A newer release may be available.'
      : ethernet.status === 'rejected'
        ? 'Could not check for Ethernet updates. A newer release may be available.'
        : undefined;
  let release: FirmwareUpdateTarget | null =
    ethernet.status === 'fulfilled' ? ethernet.value : null;
  if (usb.status === 'fulfilled' && (!release || usb.value.version >= release.latestVersion)) {
    const latestVersion = usb.value.version;
    release = {
      method: 'usb',
      latestVersion,
      updateAvailable:
        device.espVersion < latestVersion ||
        (device.espVersion === latestVersion && device.stmVersion < latestVersion),
      message: '',
    };
  }
  if (!release)
    return { error: 'Could not check the USB or Ethernet firmware releases. Try again.' };
  if (release.updateAvailable) return { ...release, warning };
  if (warning) return { error: warning };
  return {
    ...release,
    message:
      device.espVersion > release.latestVersion
        ? `Pockethernet is running v${device.espVersion}. Latest official release is v${release.latestVersion}.`
        : `Already running latest software: v${device.espVersion}`,
  };
}
