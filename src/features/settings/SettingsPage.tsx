import type { ReactElement } from 'react';
import type { DeviceInfo } from '@/pockethernetProtocol';
import type { TestId } from '@/app/types';
import type { useAppSettings } from '@/app/useAppSettings';
import { APP_VERSION } from '@/app/buildInfo';
import { Button, PageHeader, SelectField, TextField, ToggleSwitch } from '@/shared/ui/UiPrimitives';
import { ThemeSettings } from '@/shared/layout/ThemeSelector';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { PingDefaultsPanel } from '@/features/tools/PingDefaultsPanel';
import { ToolInfoRow } from '@/features/tools/ToolControls';
import { FirmwareUpdatePanel } from '@/features/firmware/FirmwareUpdatePanel';
import type { FirmwareUpdaterActions } from '@/features/firmware/useFirmwareUpdater';
import { GeneralSettings } from './GeneralSettings';
import { NetworkSettings } from './NetworkSettings';
import { BerSettingsPanel } from './BerSettingsPanel';

interface SettingsPageProps {
  app: ReturnType<typeof useAppSettings>;
  deviceInfo: DeviceInfo | null;
  firmwareUpdater: FirmwareUpdaterActions;
  disabled: boolean;
  resetDisabled: boolean;
  onToggle: (id: TestId) => void;
  onReset: () => Promise<void>;
  onNotice: (message: string) => void;
}

const TESTS: readonly [TestId, string][] = [
  ['wiremap', 'Wiremap'],
  ['tdr', 'TDR length & faults'],
  ['tdr-graph', 'TDR graph'],
  ['poe', 'PoE'],
  ['link', 'Link'],
  ['cdplldp', 'CDP / LLDP'],
  ['vlan', 'Incoming VLANs'],
  ['traffic', 'Observe traffic'],
  ['ipv4', 'IPv4'],
  ['ipv6', 'IPv6'],
  ['ping', 'Ping'],
  ['extip', 'External IP'],
  ['ber', 'Error rate / BER'],
];

export function SettingsPage({
  app,
  deviceInfo,
  firmwareUpdater,
  disabled,
  resetDisabled,
  onToggle,
  onReset,
  onNotice,
}: SettingsPageProps): ReactElement {
  const settings = app.toolSettings;
  const update = <Key extends keyof typeof settings>(
    key: Key,
    value: (typeof settings)[Key],
  ): void => app.setToolSettings((current) => ({ ...current, [key]: value }));
  return (
    <main className="settings-page">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Configure once, then test and save each cable from the Test tab."
      />
      <div className="settings-board">
        <section className="settings-card">
          <h2>Tests to run</h2>
          <fieldset disabled={disabled} className="settings-test-selection">
            <legend>Select measurements</legend>
            {TESTS.map(([id, title]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={app.selected.has(id)}
                  onChange={() => onToggle(id)}
                />
                {title}
              </label>
            ))}
          </fieldset>
          <p className="settings-hint">
            Network tests enable Link automatically. Ping and External IP also enable IPv4. Use the
            wiremap adapter for Wiremap, an active port for network tests, and the loopback adapter
            for BER.
          </p>
        </section>
        <section className="settings-card">
          <h2>Wiremap acceptance</h2>
          <fieldset disabled={disabled} className="settings-fields">
            <label className="settings-toggle">
              Shield test
              <ToggleSwitch
                checked={settings.shieldTest === true}
                ariaLabel="Shield test"
                onChange={() => update('shieldTest', !settings.shieldTest)}
              />
            </label>
            <p className="settings-hint">
              When enabled, show the shield and require shield continuity to pass. Shorts involving
              a cable pin still fail when disabled.
            </p>
            <label className="settings-toggle">
              Allow crossover
              <ToggleSwitch
                checked={settings.allowCrossover !== false}
                ariaLabel="Allow crossover"
                onChange={() => update('allowCrossover', settings.allowCrossover === false)}
              />
            </label>
            <SelectField
              label="Required wiring"
              value={settings.requiredPairs ?? 'any'}
              onChange={(event) =>
                update(
                  'requiredPairs',
                  event.target.value === '2' ? '2' : event.target.value === '4' ? '4' : 'any',
                )
              }
            >
              <option value="any">Wiremap only (existing classifications)</option>
              <option value="2">2 pairs (pins 1, 2, 3, 6)</option>
              <option value="4">4 pairs (all 8 pins)</option>
            </SelectField>
            <p className="settings-hint">
              These are wiring requirements. They do not qualify a cable for a specific Ethernet
              speed.
            </p>
          </fieldset>
        </section>
        <section className="settings-card">
          <fieldset disabled={disabled}>
            <GeneralSettings
              settings={settings}
              onSettingsChange={app.setToolSettings}
              reportPreferences={app.reportPreferences}
              onReportPreferencesChange={app.setReportPreferences}
              onNotice={onNotice}
            />
          </fieldset>
        </section>
        <section className="settings-card">
          <h2>Network & discovery</h2>
          <fieldset disabled={disabled}>
            <NetworkSettings
              settings={app.measurementSettings}
              onChange={app.setMeasurementSettings}
              pingTargets={app.pingTargets}
              onPingTargetsChange={app.setPingTargets}
            />
            <PingDefaultsPanel defaults={app.pingDefaults} onChange={app.changePingDefaults} />
          </fieldset>
        </section>
        <section className="settings-card">
          <h2>Error rate / BER</h2>
          <fieldset disabled={disabled}>
            <BerSettingsPanel
              settings={app.measurementSettings}
              onChange={app.setMeasurementSettings}
            />
          </fieldset>
        </section>
        <section className="settings-card">
          <h2>Project & workflow</h2>
          <fieldset disabled={disabled} className="settings-fields">
            {(
              [
                ['project', 'Project'],
                ['address', 'Address / site'],
                ['user', 'Technician'],
                ['location', 'Location'],
              ] as const
            ).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={app.reportDetails[key] ?? ''}
                maxLength={160}
                onChange={(event) =>
                  app.setReportDetails((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            ))}
            <label className="settings-toggle">
              Auto increment Cable ID
              <ToggleSwitch
                checked={app.autoIncrement}
                ariaLabel="Auto increment Cable ID"
                onChange={() => app.setAutoIncrement(!app.autoIncrement)}
              />
            </label>
            <p className="settings-hint">
              Save & next increases the final number, preserves leading zeros, and skips existing
              cable IDs. Retrying a test keeps the same ID.
            </p>
            <SelectField
              label="Decimal separator"
              value={settings.decimalSeparator ?? '.'}
              onChange={(event) =>
                update('decimalSeparator', event.target.value === ',' ? ',' : '.')
              }
            >
              <option value=".">0.00</option>
              <option value=",">0,00</option>
            </SelectField>
          </fieldset>
        </section>
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
