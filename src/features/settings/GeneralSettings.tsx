import type { ChangeEvent, ReactElement } from 'react';
import type { ToolSettings, ReportPreferences, StateSetter } from '@/app/types';
import { ToolControl, ToolField, ToolPanel } from '@/features/tools/ToolControls';
import { resizeReportImage } from '@/features/reports/images';

interface GeneralSettingsProps {
  disabled: boolean;
  settings: ToolSettings;
  onSettingsChange: StateSetter<ToolSettings>;
  reportPreferences: ReportPreferences;
  onReportPreferencesChange: StateSetter<ReportPreferences>;
  onNotice: (message: string) => void;
}

export function GeneralSettings({
  disabled,
  settings,
  onSettingsChange,
  reportPreferences,
  onReportPreferencesChange,
  onNotice,
}: GeneralSettingsProps): ReactElement {
  const updateSettings = <Key extends keyof ToolSettings>(
    name: Key,
    value: ToolSettings[Key],
  ): void => {
    onSettingsChange((current) => ({ ...current, [name]: value }));
  };
  const chooseReportLogo = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const logoDataUrl = await resizeReportImage(file, 1200, 400, 'image/png');
      onReportPreferencesChange((current) => ({ ...current, logoDataUrl, logoName: file.name }));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not read this logo.');
    }
    event.target.value = '';
  };
  return (
    <ToolPanel
      className="tool-panel-settings"
      disabled={disabled}
      title="Cable & report settings"
      active={false}
      summary="Cable and report defaults"
    >
      <ToolControl
        label="TIA"
        name="tia"
        value={settings.tia}
        options={[
          ['568A', '568A'],
          ['568B', '568B'],
        ]}
        onChange={updateSettings}
      />
      <ToolControl
        label="Units"
        name="units"
        value={settings.units}
        options={[
          ['meters', 'Meters'],
          ['feet', 'Feet'],
        ]}
        onChange={updateSettings}
      />
      <ToolField
        label="NVP value"
        value={settings.nvp}
        onChange={(event) => {
          updateSettings('nvp', event.target.value.replace(/\D/g, '').slice(0, 3));
        }}
        inputMode="numeric"
      />
      <ToolControl
        label="Custom MAC"
        name="customMac"
        value={settings.customMac}
        options={[
          ['off', 'Off'],
          ['on', 'On'],
        ]}
        onChange={updateSettings}
      />
      <ToolField
        label="MAC"
        value={settings.mac}
        onChange={(event) => {
          updateSettings('mac', event.target.value.slice(0, 17));
        }}
        placeholder="00:11:22:33:44:55"
        disabled={settings.customMac !== 'on'}
      />
      <div className="tool-action report-logo-action">
        <span>Report logo</span>
        {reportPreferences.logoDataUrl && (
          <img src={reportPreferences.logoDataUrl} alt="Current report logo" />
        )}
        <label className="tool-action-button">
          {reportPreferences.logoName || 'Add custom logo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void chooseReportLogo(event)}
          />
        </label>
        {reportPreferences.logoDataUrl && (
          <button
            type="button"
            className="report-logo-remove"
            aria-label="Remove custom report logo"
            title="Remove custom report logo"
            onClick={() =>
              onReportPreferencesChange((current) => ({
                ...current,
                logoDataUrl: '',
                logoName: '',
              }))
            }
          >
            ×
          </button>
        )}
      </div>
      <ToolControl
        label="Show bottom report logo"
        name="showFooterLogo"
        value={reportPreferences.showFooterLogo ? 'on' : 'off'}
        options={[
          ['off', 'Off'],
          ['on', 'On'],
        ]}
        onChange={(_, value) =>
          onReportPreferencesChange((current) => ({
            ...current,
            showFooterLogo: value === 'on',
          }))
        }
      />
    </ToolPanel>
  );
}
