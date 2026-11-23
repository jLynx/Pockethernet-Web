import { loadImages } from './usb/firmware';
import { requestPort, selectTransport } from './usb/serial';
import type { UpdateMode } from './usb/updateDevice';
import type { loadOfficialUsbManifest } from './officialFirmware';

function usbTransport(): ReturnType<typeof selectTransport> {
  return typeof window !== 'undefined' && window.isSecureContext ? selectTransport() : undefined;
}

export function supportsUsbUpdate(): boolean {
  return !!usbTransport();
}

export class UsbReleaseChangedError extends Error {}

export async function runUsbFirmwareUpdate(options: {
  version: number;
  mode: UpdateMode;
  loadManifest: typeof loadOfficialUsbManifest;
  onStage: (message: string) => void;
  onProgress: (fraction: number) => void;
  onWriteStarting: () => void;
}): Promise<'complete' | 'cancelled'> {
  const { version, mode, loadManifest, onStage, onProgress, onWriteStarting } = options;
  const transport = usbTransport();
  if (!transport) throw new Error('Open Pocketweb in Chrome or Edge to update over USB.');
  onStage('Select Pockethernet 2 in the device picker.');
  let port;
  try {
    // The browser requires the picker to open directly from the button click.
    port = await requestPort(transport);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return 'cancelled';
    throw error;
  }
  onStage('Downloading and checking firmware…');
  const manifest = await loadManifest();
  if (manifest.version !== version)
    throw new UsbReleaseChangedError(
      'The USB release changed. Reconnect and check for updates again.',
    );
  const images = await loadImages(manifest, () => {});
  const { updateDevice } = await import('./usb/updateDevice');
  await updateDevice(port, images, mode, { onStage, onProgress, onWriteStarting, log: () => {} });
  return 'complete';
}
