import type { ReactElement } from 'react';
import type { DeviceInfo } from '@/pockethernetProtocol';
import { APP_VERSION } from '@/app/buildInfo';
import { Button, PageHeader } from '@/shared/ui/UiPrimitives';
import { ThemeSettings } from '@/shared/layout/ThemeSelector';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { ToolInfoRow } from '@/features/tools/ToolControls';
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
    <main className="settings-page">
      <PageHeader
        eyebrow="App & device"
        title="Settings"
        description="Manage appearance, notifications, device firmware, and local application data."
      />
      <div className="settings-board">
        <section className="settings-card">
          <h2>Appearance & notifications</h2>
          <ThemeSettings />
          <NotificationSettings />
        </section>
        <section className="settings-card">
          <h2>About & firmware</h2>
          <ToolInfoRow label="App version" value={APP_VERSION} />
          <ToolInfoRow
            label="Device"
            value={deviceInfo ? `Serial ${deviceInfo.serial}` : 'Connect to view device info'}
          />
          {deviceInfo && (
            <>
              <ToolInfoRow label="MAC" value={deviceInfo.mac} />
              <ToolInfoRow
                label="FW version"
                value={`${deviceInfo.espVersion}.${deviceInfo.stmVersion}`}
              />
            </>
          )}
          <FirmwareUpdatePanel updater={firmwareUpdater} deviceInfo={deviceInfo} />
        </section>
        <section className="settings-card">
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
    </main>
  );
}
