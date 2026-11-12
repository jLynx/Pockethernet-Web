import type { ReactElement, ReactNode } from 'react';
import type { TestId } from '@/app/types';
import type { useAppSettings } from '@/app/useAppSettings';
import { PageHeader, SelectField, TextField } from '@/shared/ui/UiPrimitives';
import { PingDefaultsPanel } from '@/features/tools/PingDefaultsPanel';
import { ToolControl, ToolPanel } from '@/features/tools/ToolControls';
import { GeneralSettings } from './GeneralSettings';
import { NetworkSettings } from './NetworkSettings';
import { BerSettingsPanel } from './BerSettingsPanel';

interface ConfigurePageProps {
  app: ReturnType<typeof useAppSettings>;
  disabled: boolean;
  onToggle: (id: TestId) => void;
  onNotice: (message: string) => void;
  workflowSelector?: ReactNode;
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

export function ConfigurePage({
  app,
  disabled,
  onToggle,
  onNotice,
  workflowSelector,
}: ConfigurePageProps): ReactElement {
  const settings = app.toolSettings;
  const batch = app.workflowMode === 'batch';
  const update = <Key extends keyof typeof settings>(
    key: Key,
    value: (typeof settings)[Key],
  ): void => app.setToolSettings((current) => ({ ...current, [key]: value }));
  return (
    <main className="settings-page configure-page">
      <PageHeader
        className="tools-header"
        eyebrow="Test & report setup"
        title="Configure"
        description={
          batch
            ? 'Configure batch tests and report defaults once, then work through your cables from Test.'
            : 'Set cable and report defaults here. Choose tests and adjust network or BER controls on Test.'
        }
      >
        {workflowSelector}
      </PageHeader>
      <div className="settings-board">
        <div className="settings-column">
          {batch && (
            <ToolPanel title="Tests to run" disabled={disabled}>
              <fieldset className="settings-test-selection">
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
                Network tests enable Link automatically. Ping and External IP also enable IPv4. Use
                the wiremap adapter for Wiremap, an active port for network tests, and the loopback
                adapter for BER.
              </p>
            </ToolPanel>
          )}
          <ToolPanel title="Wiremap acceptance" disabled={disabled}>
            <div className="settings-fields">
              <ToolControl
                label="Shield test"
                name="shieldTest"
                value={settings.shieldTest === true ? 'on' : 'off'}
                options={[
                  ['off', 'Off'],
                  ['on', 'On'],
                ]}
                onChange={(_, value) => update('shieldTest', value === 'on')}
              />
              <p className="settings-hint">
                When enabled, show the shield and require shield continuity to pass. Shorts
                involving a cable pin still fail when disabled.
              </p>
              <ToolControl
                label="Allow crossover"
                name="allowCrossover"
                value={settings.allowCrossover !== false ? 'on' : 'off'}
                options={[
                  ['off', 'Off'],
                  ['on', 'On'],
                ]}
                onChange={(_, value) => update('allowCrossover', value === 'on')}
              />
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
            </div>
          </ToolPanel>
          <ToolPanel title="Project & workflow" disabled={disabled}>
            <div className="settings-fields">
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
              {batch && (
                <>
                  <ToolControl
                    label="Auto increment Cable ID"
                    name="autoIncrement"
                    value={app.autoIncrement ? 'on' : 'off'}
                    options={[
                      ['off', 'Off'],
                      ['on', 'On'],
                    ]}
                    onChange={(_, value) => app.setAutoIncrement(value === 'on')}
                  />
                  <p className="settings-hint">
                    Save & next increases the final number, preserves leading zeros, and skips
                    existing cable IDs. Retrying a test keeps the same ID.
                  </p>
                </>
              )}
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
            </div>
          </ToolPanel>
        </div>
        <div className="settings-column">
          <GeneralSettings
            disabled={disabled}
            settings={settings}
            onSettingsChange={app.setToolSettings}
            reportPreferences={app.reportPreferences}
            onReportPreferencesChange={app.setReportPreferences}
            onNotice={onNotice}
          />
          {batch && (
            <>
              <ToolPanel title="Network & discovery" disabled={disabled}>
                <NetworkSettings
                  settings={app.measurementSettings}
                  onChange={app.setMeasurementSettings}
                  pingTargets={app.pingTargets}
                  onPingTargetsChange={app.setPingTargets}
                />
              </ToolPanel>
              <PingDefaultsPanel
                disabled={disabled}
                defaults={app.pingDefaults}
                onChange={app.changePingDefaults}
              />
              <ToolPanel title="Error rate / BER" disabled={disabled}>
                <BerSettingsPanel
                  settings={app.measurementSettings}
                  onChange={app.setMeasurementSettings}
                />
              </ToolPanel>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
