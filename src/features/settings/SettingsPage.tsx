import type { ReactElement } from 'react';
import type { DeviceInfo } from '@/pockethernetProtocol';
import { APP_VERSION } from '@/app/buildInfo';
import type { MeasurementDisplay, StateSetter } from '@/app/types';
import { SelectField } from '@/shared/ui/UiPrimitives';
import { PageLayout } from '@/shared/layout/PageLayout';
import { ThemeSettings } from '@/shared/layout/ThemeSelector';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { ToolControl, ToolInfoRow, ToolPanel } from '@/features/tools/ToolControls';
import { FirmwareUpdatePanel } from '@/features/firmware/FirmwareUpdatePanel';
import type { FirmwareUpdaterActions } from '@/features/firmware/useFirmwareUpdater';
import { TesterHelp } from './TesterHelp';
import { ResetSettingsPanel } from './ResetSettingsPanel';

interface SettingsPageProps {
  deviceInfo: DeviceInfo | null;
  firmwareUpdater: FirmwareUpdaterActions;
  measurementDisplay: MeasurementDisplay;
  onMeasurementDisplayChange: StateSetter<MeasurementDisplay>;
  resetDisabled: boolean;
  onReset: () => Promise<void>;
}

export function SettingsPage({
  deviceInfo,
  firmwareUpdater,
  measurementDisplay,
  onMeasurementDisplayChange,
  resetDisabled,
  onReset,
}: SettingsPageProps): ReactElement {
  return (
    <PageLayout
      className="tools-page app-settings-page"
      eyebrow="App & device"
      title="Settings"
      description="Appearance, notifications, and device information."
    >
      <ThemeSettings />
      <div className="tools-board">
        <div className="tools-column">
          <ToolPanel title="Measurement display">
            <ToolControl
              label="Distance units"
              name="units"
              value={measurementDisplay.units}
              options={[
                ['meters', 'Meters'],
                ['feet', 'Feet'],
              ]}
              onChange={(_, units) =>
                onMeasurementDisplayChange((current) => ({ ...current, units }))
              }
            />
            <div className="settings-fields">
              <SelectField
                label="Decimal separator"
                value={measurementDisplay.decimalSeparator}
                onChange={(event) => {
                  const decimalSeparator = event.target.value === ',' ? ',' : '.';
                  onMeasurementDisplayChange((current) => ({ ...current, decimalSeparator }));
                }}
              >
                <option value=".">0.00</option>
                <option value=",">0,00</option>
              </SelectField>
            </div>
          </ToolPanel>
          <NotificationSettings />
        </div>
        <div className="tools-column">
          <ToolPanel
            title="About & firmware"
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
          <TesterHelp />
          <ResetSettingsPanel disabled={resetDisabled} onReset={onReset} />
        </div>
      </div>
    </PageLayout>
  );
}
