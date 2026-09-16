import type { ChangeEvent, ReactElement } from 'react';
import type { DeviceInfo } from '@/pockethernetProtocol';
import type {
  BlinkerSettings,
  FirmwareCheck,
  ReportPreferences,
  StateSetter,
  TonerSettings,
  ToolSettings,
  WifiSettings,
} from '@/app/types';
import { ToolAction, ToolControl, ToolField, ToolInfoRow, ToolPanel } from './ToolControls';
import { PageHeader } from '@/shared/ui/UiPrimitives';
import { resizeReportImage } from '@/features/reports/images';

interface ToolsPageProps {
  deviceInfo: DeviceInfo | null;
  firmwareCheck: FirmwareCheck | null;
  firmwareChecking: boolean;
  onCheckFirmware: () => Promise<void>;
  settings: ToolSettings;
  onSettingsChange: StateSetter<ToolSettings>;
  blinkerSettings: BlinkerSettings;
  onBlinkerSettingsChange: StateSetter<BlinkerSettings>;
  onBlinkerChange: (settings: BlinkerSettings, tonerActive: boolean) => Promise<boolean>;
  tonerSettings: TonerSettings;
  onTonerSettingsChange: StateSetter<TonerSettings>;
  onTonerChange: (settings: TonerSettings, blinkerActive: boolean) => Promise<boolean>;
  wifiSettings: WifiSettings;
  onWifiSettingsChange: StateSetter<WifiSettings>;
  onWifiChange: (settings: WifiSettings) => Promise<boolean>;
  reportPreferences: ReportPreferences;
  onReportPreferencesChange: StateSetter<ReportPreferences>;
  onNotice: (message: string) => void;
}

export function ToolsPage(props: ToolsPageProps): ReactElement {
  const {
    deviceInfo,
    firmwareCheck,
    firmwareChecking,
    onCheckFirmware,
    settings,
    onSettingsChange,
    blinkerSettings,
    onBlinkerSettingsChange,
    onBlinkerChange,
    tonerSettings,
    onTonerSettingsChange,
    onTonerChange,
    wifiSettings,
    onWifiSettingsChange,
    onWifiChange,
    reportPreferences,
    onReportPreferencesChange,
    onNotice,
  } = props;
  const updateToner = async <Key extends keyof TonerSettings>(
    name: Key,
    value: TonerSettings[Key],
  ): Promise<void> => {
    const next = { ...tonerSettings, [name]: value };
    const shouldApply = name === 'power' || tonerSettings.power === 'on';
    if (shouldApply && !(await onTonerChange(next, blinkerSettings.link !== 'off'))) return;
    onTonerSettingsChange(next);
  };
  const updateBlinker = async <Key extends keyof BlinkerSettings>(
    name: Key,
    value: BlinkerSettings[Key],
  ): Promise<void> => {
    const next = { ...blinkerSettings, [name]: value };
    if (name === 'link' && !(await onBlinkerChange(next, tonerSettings.power === 'on'))) return;
    onBlinkerSettingsChange(next);
  };
  const updateSettings = <Key extends keyof ToolSettings>(
    name: Key,
    value: ToolSettings[Key],
  ): void => {
    onSettingsChange((current) => ({ ...current, [name]: value }));
  };
  const updateWifi = async <Key extends keyof WifiSettings>(
    name: Key,
    value: WifiSettings[Key],
  ): Promise<void> => {
    const next = { ...wifiSettings, [name]: value };
    const shouldApply = name === 'enabled' || wifiSettings.enabled === 'on';
    if (shouldApply && !(await onWifiChange(next))) return;
    onWifiSettingsChange(next);
  };
  const chooseReportLogo = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const logoDataUrl = await resizeReportImage(file, 1200, 400, 'image/png');
      onReportPreferencesChange({ logoDataUrl, logoName: file.name });
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not read this logo.');
    }
    event.target.value = '';
  };
  return (
    <main className="tools-page">
      <PageHeader
        className="tools-header"
        eyebrow="Device tools"
        title="Signal and device controls"
        description="Configure cable tone, link behavior, and device preferences."
        action={
          <a
            className="tools-manual-link"
            href="https://pockethernet.com/manual"
            target="_blank"
            rel="noreferrer"
          >
            Manual
          </a>
        }
      />
      <div className="tools-board">
        <ToolPanel
          className="tool-panel-toner"
          title="Cable toner"
          active={tonerSettings.power === 'on'}
          summary={
            tonerSettings.power === 'on'
              ? `Pair ${tonerSettings.pair === 'all' ? 'all' : tonerSettings.pair} · Tone ${tonerSettings.tone}`
              : 'Tone generator is off'
          }
        >
          <ToolControl
            label="Pair"
            name="pair"
            value={tonerSettings.pair}
            options={[
              ['2', 'P2'],
              ['3', 'P3'],
              ['1', 'P1'],
              ['4', 'P4'],
              ['all', 'All'],
            ]}
            onChange={updateToner}
          />
          <ToolControl
            label="Shield tone"
            name="shield"
            value={tonerSettings.shield}
            options={[
              ['off', 'Off'],
              ['on', 'On'],
            ]}
            onChange={updateToner}
          />
          <ToolControl
            label="Tone"
            name="tone"
            value={tonerSettings.tone}
            options={[
              ['1', '1'],
              ['2', '2'],
              ['3', '3'],
              ['4', '4'],
            ]}
            onChange={updateToner}
          />
          <ToolControl
            label="Volume"
            name="volume"
            value={tonerSettings.volume}
            options={[
              ['low', 'Low'],
              ['high', 'High'],
            ]}
            onChange={updateToner}
          />
          <ToolControl
            label="On/Off"
            name="power"
            value={tonerSettings.power}
            options={[
              ['off', 'Off'],
              ['on', 'On'],
            ]}
            onChange={updateToner}
          />
        </ToolPanel>
        <ToolPanel
          title="Link blinker"
          active={blinkerSettings.link !== 'off'}
          summary={
            blinkerSettings.link === 'off'
              ? 'Link signaling is off'
              : `${blinkerSettings.link} · ${blinkerSettings.speed}`
          }
        >
          <ToolControl
            label="Speed"
            name="speed"
            value={blinkerSettings.speed}
            options={[
              ['10', '10'],
              ['100', '100'],
              ['1000', '1000'],
              ['auto', 'Auto'],
            ]}
            onChange={updateBlinker}
          />
          <ToolControl
            label="Duplex"
            name="duplex"
            value={blinkerSettings.duplex}
            options={[
              ['half', 'Half'],
              ['full', 'Full'],
              ['auto', 'Auto'],
            ]}
            onChange={updateBlinker}
          />
          <ToolControl
            label="MDI-X"
            name="mdi"
            value={blinkerSettings.mdi}
            options={[
              ['mdi', 'MDI'],
              ['mdix', 'MDI-X'],
              ['auto', 'Auto'],
            ]}
            onChange={updateBlinker}
          />
          <ToolControl
            label="Link"
            name="link"
            value={blinkerSettings.link}
            options={[
              ['off', 'Off'],
              ['on', 'On'],
              ['blink', 'Blink'],
            ]}
            onChange={updateBlinker}
          />
        </ToolPanel>
        <ToolPanel
          className="tool-panel-settings"
          title="Device preferences"
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
                onClick={() => onReportPreferencesChange({ logoDataUrl: '', logoName: '' })}
              >
                ×
              </button>
            )}
          </div>
        </ToolPanel>
        <div className="tools-secondary">
          <ToolPanel
            title="WiFi bridge"
            active={wifiSettings.enabled === 'on'}
            summary={wifiSettings.enabled === 'on' ? 'Bridge enabled' : 'Bridge disabled'}
          >
            <ToolField
              label="WiFi name"
              value={wifiSettings.name}
              onChange={(event) => {
                void updateWifi('name', event.target.value.slice(0, 32));
              }}
            />
            <ToolField
              label="WiFi password"
              value={wifiSettings.password}
              onChange={(event) => {
                void updateWifi('password', event.target.value.slice(0, 63));
              }}
            />
            <ToolControl
              label="Enable"
              name="enabled"
              value={wifiSettings.enabled}
              options={[
                ['off', 'Off'],
                ['on', 'On'],
              ]}
              onChange={updateWifi}
            />
          </ToolPanel>
          <ToolPanel
            className="tool-panel-info"
            title="Device info"
            active={Boolean(deviceInfo)}
            summary={deviceInfo ? 'Connected device' : 'No device connected'}
          >
            <ToolInfoRow label="App version" value="Web migration" />
            {deviceInfo ? (
              <>
                <ToolInfoRow label="Serial" value={String(deviceInfo.serial)} />
                <ToolInfoRow label="MAC" value={deviceInfo.mac} />
                <ToolInfoRow
                  label="FW version"
                  value={`${deviceInfo.espVersion}.${deviceInfo.stmVersion}`}
                />
                <ToolAction
                  label="Firmware"
                  action={firmwareChecking ? 'Checking...' : 'Check for upgrade'}
                  disabled={firmwareChecking}
                  onClick={() => {
                    void onCheckFirmware();
                  }}
                />
                {firmwareCheck && (
                  <div
                    className={`tool-firmware-result ${'error' in firmwareCheck ? 'error' : firmwareCheck.updateAvailable ? 'update' : 'current'}`}
                  >
                    {'error' in firmwareCheck ? firmwareCheck.error : firmwareCheck.message}
                  </div>
                )}
              </>
            ) : (
              <ToolInfoRow label="Device Info" value="Connect to view device info" />
            )}
          </ToolPanel>
        </div>
      </div>
    </main>
  );
}
