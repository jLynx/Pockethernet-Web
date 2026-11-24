import type { ChangeEvent, ReactElement } from 'react';
import type { ToolSettings, ReportPreferences, StateSetter, ReportResults } from '@/app/types';
import { ToolControl, ToolField, ToolPanel } from '@/features/tools/ToolControls';
import { resizeReportImage } from '@/features/reports/images';
import { NvpCalibration } from './NvpCalibration';

interface GeneralSettingsProps {
  disabled: boolean;
  settings: ToolSettings;
  lastTdr?: ReportResults['tdr'];
  onSettingsChange: StateSetter<ToolSettings>;
  reportPreferences: ReportPreferences;
  onReportPreferencesChange: StateSetter<ReportPreferences>;
  onNotice: (message: string) => void;
}

export function GeneralSettings({
  disabled,
  settings,
  lastTdr,
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
    <ToolPanel className="tool-panel-settings" disabled={disabled} title="Cable & report settings">
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
        label="Pin order in wiremap"
        name="wiremapPinOrder"
        value={settings.wiremapPinOrder ?? 'pairwise'}
        options={[
          ['pairwise', 'Pairwise'],
          ['sequential', 'Sequential'],
        ]}
        onChange={updateSettings}
      />
      <NvpCalibration
        settings={settings}
        lastTdr={lastTdr}
        onChange={(value) => updateSettings('nvp', value)}
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
      {settings.customMac === 'on' && (
        <ToolField
          label="MAC"
          value={settings.mac}
          onChange={(event) => {
            updateSettings('mac', event.target.value.slice(0, 17));
          }}
          placeholder="00:11:22:33:44:55"
        />
      )}
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
