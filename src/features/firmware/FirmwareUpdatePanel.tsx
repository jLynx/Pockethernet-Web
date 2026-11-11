import type { ReactElement } from 'react';
import type { DeviceInfo } from '@/pockethernetProtocol';
import { Button } from '@/shared/ui/UiPrimitives';
import { ToolAction } from '@/features/tools/ToolControls';
import { updateLocked, updateWorking } from './firmwareUpdateController';
import type { FirmwareUpdaterActions } from './useFirmwareUpdater';
import { AdvancedFirmwareForm } from './AdvancedFirmwareForm';
import { FirmwareUpdateConfirmation } from './FirmwareUpdateConfirmation';

const STAGES: Partial<Record<FirmwareUpdaterActions['state']['phase'], string>> = {
  uploading: 'Uploading the OTA file to temporary hosting',
  preparing: 'Checking the connected device',
  link: 'Establishing Ethernet link',
  dhcp: 'Obtaining an IP address via DHCP',
  settling: 'Waiting for the Ethernet address to become ready',
  installing: 'Downloading and installing firmware',
  finishing: 'Finishing the update',
};

export function FirmwareUpdatePanel({
  updater,
  deviceInfo,
}: {
  updater: FirmwareUpdaterActions;
  deviceInfo: DeviceInfo | null;
}): ReactElement {
  const { state, blockedReason } = updater;
  const check = state.check;
  const available = check && !('error' in check) && check.updateAvailable;
  const working = updateWorking(state);
  const locked = updateLocked(state);
  const waitingForRestart = state.phase === 'restart' || state.phase === 'unknown';
  return (
    <div className="firmware-updater">
      {!locked && !state.advanced && !available && state.phase !== 'confirm' && (
        <ToolAction
          label="Firmware"
          action={state.checking ? 'Checking...' : 'Check for upgrade'}
          disabled={!deviceInfo || state.checking || state.selecting}
          onClick={(event) => {
            if (event.shiftKey) updater.openAdvanced();
            else void updater.check();
          }}
        />
      )}
      {check && !available && !locked && !state.advanced && state.phase !== 'confirm' && (
        <div className={`tool-firmware-result ${'error' in check ? 'error' : 'current'}`}>
          {'error' in check ? check.error : check.message}
        </div>
      )}
      {available && !locked && !state.advanced && state.phase !== 'confirm' && (
        <section className="firmware-offer" aria-label="Firmware update available">
          <div className="firmware-update-notice">
            <p role="status">Update available: v{check.latestVersion}</p>
            <Button
              variant="primary"
              className="firmware-update-button"
              disabled={!deviceInfo || !!blockedReason}
              onClick={(event) => {
                if (event.shiftKey) updater.openAdvanced();
                else updater.confirm();
              }}
            >
              Update
            </Button>
          </div>
          {blockedReason && <p className="firmware-offer-help">{blockedReason}</p>}
        </section>
      )}
      {state.advanced && !locked && state.phase !== 'confirm' && (
        <AdvancedFirmwareForm updater={updater} />
      )}
      {state.phase === 'confirm' && (
        <FirmwareUpdateConfirmation updater={updater} deviceInfo={deviceInfo} />
      )}
      {working && (
        <div className="firmware-status" role="status">
          <h3>{STAGES[state.phase] ?? 'Updating firmware'}</h3>
          <div
            className="firmware-progress"
            role="progressbar"
            aria-label="Firmware update in progress"
          >
            <span className="firmware-progress-bar" aria-hidden="true" />
          </div>
          <p>Keep Pockethernet powered on, Ethernet connected and this page open.</p>
          <p className="firmware-detail">
            The device reports a final result when finished. Download progress is not available.
          </p>
        </div>
      )}
      {waitingForRestart && (
        <div className={`firmware-status ${state.phase}`} role="status">
          <h3>
            {state.phase === 'restart'
              ? 'Update ready · restart required'
              : 'Update result unknown'}
          </h3>
          <p>{state.message}</p>
          {state.phase === 'unknown' && (
            <p>
              Keep power and Ethernet connected for at least five minutes after starting the update.
              Then restart and verify before trying another update.
            </p>
          )}
          <p className="firmware-detail">
            Unplug USB, turn Pockethernet off, wait five seconds, then turn it on. Reconnect USB if
            needed.
          </p>
          <Button
            variant="primary"
            disabled={state.verifying}
            onClick={() => void updater.verify()}
          >
            {state.verifying ? 'Verifying...' : 'I have restarted · verify firmware'}
          </Button>
        </div>
      )}
      {['failed', 'verified', 'unconfirmed'].includes(state.phase) && state.message && (
        <div className={`firmware-status ${state.phase}`} role="status">
          <h3>
            {state.phase === 'verified'
              ? 'Firmware version confirmed'
              : state.phase === 'unconfirmed'
                ? 'Build not verified'
                : 'Update stopped'}
          </h3>
          <p>{state.message}</p>
        </div>
      )}
    </div>
  );
}
