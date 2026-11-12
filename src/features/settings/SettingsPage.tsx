import type { ReactElement } from 'react';
import type { DeviceInfo } from '@/pockethernetProtocol';
import { APP_VERSION } from '@/app/buildInfo';
import { Button, PageHeader } from '@/shared/ui/UiPrimitives';
import { ThemeSettings } from '@/shared/layout/ThemeSelector';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { ToolInfoRow, ToolPanel } from '@/features/tools/ToolControls';
import { FirmwareUpdatePanel } from '@/features/firmware/FirmwareUpdatePanel';
import type { FirmwareUpdaterActions } from '@/features/firmware/useFirmwareUpdater';

interface SettingsPageProps {
  deviceInfo: DeviceInfo | null;
  firmwareUpdater: FirmwareUpdaterActions;
  resetDisabled: boolean;
  onReset: () => Promise<void>;
}

export function SettingsPage({
  deviceInfo,
  firmwareUpdater,
  resetDisabled,
  onReset,
}: SettingsPageProps): ReactElement {
  return (
    <main className="tools-page app-settings-page">
      <PageHeader
        className="tools-header"
        eyebrow="App & device"
        title="Settings"
        description="Appearance, notifications, and device information."
      />
      <ThemeSettings />
      <div className="tools-board">
        <div className="tools-column">
          <NotificationSettings />
        </div>
        <div className="tools-column">
          <ToolPanel
            title="About & firmware"
            active={!!deviceInfo}
            summary={deviceInfo ? 'Connected device' : 'Connect to view device info'}
          >
            <ToolInfoRow label="App version" value={APP_VERSION} />
            {deviceInfo && (
              <>
                <ToolInfoRow label="Serial" value={String(deviceInfo.serial)} />
                <ToolInfoRow label="MAC" value={deviceInfo.mac} />
                <ToolInfoRow
                  label="FW version"
                  value={`${deviceInfo.espVersion}.${deviceInfo.stmVersion}`}
                />
              </>
            )}
            <FirmwareUpdatePanel updater={firmwareUpdater} deviceInfo={deviceInfo} />
          </ToolPanel>
          <section className="settings-card settings-reset">
            <h2>Reset Pocketweb</h2>
            <p className="settings-hint">
              Delete reports and restore application settings on this browser. Device firmware and
              browser permissions are unchanged.
            </p>
            <Button disabled={resetDisabled} onClick={() => void onReset()}>
              Reset settings & delete reports
            </Button>
          </section>
        </div>
      </div>
    </main>
  );
}
