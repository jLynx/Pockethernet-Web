import type { ReactElement } from 'react';
import type { DeviceInfo } from '@/pockethernetProtocol';
import { Button } from '@/shared/ui/UiPrimitives';
import type { FirmwareUpdaterActions } from './useFirmwareUpdater';
import type { FirmwareUpdateTarget } from './updateTarget';

export function FirmwareUpdateConfirmation({
  updater,
  deviceInfo,
}: {
  updater: FirmwareUpdaterActions;
  deviceInfo: DeviceInfo | null;
}): ReactElement | null {
  const target: FirmwareUpdateTarget | null =
    updater.state.selection ??
    (updater.state.check && !('error' in updater.state.check) ? updater.state.check : null);
  if (!target) return null;
  const custom = 'source' in target && (target.source === 'url' || target.source === 'file');
  const file = 'source' in target && target.source === 'file';
  return (
    <section className="firmware-status" aria-label="Confirm firmware update">
      <h3>
        {custom
          ? `Install ESP v${deviceInfo?.espVersion} → v${target.latestVersion}?`
          : `Update to v${target.latestVersion}?`}
      </h3>
      {custom && (
        <p className="firmware-source">{'label' in target ? target.label : target.downloadUrl}</p>
      )}
      {file && 'bytes' in target && (
        <p className="firmware-detail">
          {target.bytes?.toLocaleString()} bytes · ESP version read from the PEUI header
        </p>
      )}
      <p>
        {custom
          ? 'Connect Pockethernet to an Ethernet switch with DHCP and access to the download host.'
          : 'Connect Pockethernet to an Internet-connected Ethernet switch.'}{' '}
        Keep it powered on and keep this page open during the update.
      </p>
      <p className="firmware-detail">
        {custom
          ? 'This replaces the ESP application with your chosen firmware. The device performs firmware authentication and image validation. STM firmware stays unchanged.'
          : 'You’ll be asked to restart Pockethernet once the update finishes.'}
      </p>
      {file && (
        <p className="firmware-detail">
          Starting uploads this file to Pocketweb for 30 minutes. Its download link can be accessed
          by anyone who has the link.
        </p>
      )}
      {custom && target.latestVersion === deviceInfo?.espVersion && (
        <p className="firmware-detail">
          Both builds report ESP v{target.latestVersion}. After restart, the version number alone
          cannot distinguish them.
        </p>
      )}
      <div className="firmware-actions">
        <Button
          variant="primary"
          disabled={!!updater.blockedReason || !deviceInfo}
          onClick={() => void updater.start()}
        >
          {file ? 'Upload and start update' : 'Start update'}
        </Button>
        <Button onClick={updater.cancel}>Cancel</Button>
      </div>
      {updater.blockedReason && <p>{updater.blockedReason}</p>}
    </section>
  );
}
