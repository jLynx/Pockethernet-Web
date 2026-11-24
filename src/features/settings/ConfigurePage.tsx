import type { ReactElement, ReactNode } from 'react';
import type { ReportResults, TestId, UnavailableTests } from '@/app/types';
import type { useAppSettings } from '@/app/useAppSettings';
import { Checkbox, SelectField } from '@/shared/ui/UiPrimitives';
import { PageLayout } from '@/shared/layout/PageLayout';
import { PingDefaultsPanel } from '@/features/tools/PingDefaultsPanel';
import { ToolControl, ToolPanel } from '@/features/tools/ToolControls';
import { GeneralSettings } from './GeneralSettings';
import { NetworkSettings } from './NetworkSettings';
import { BerSettingsPanel } from './BerSettingsPanel';
import { PresetSettings } from './SavedConfigurations';
import { ProjectSettings } from './ProjectSettings';
import { discoveryLabel } from '@/app/measurementSettings';

interface ConfigurePageProps {
  app: ReturnType<typeof useAppSettings>;
  disabled: boolean;
  firmwareVersion?: number;
  lastTdr?: ReportResults['tdr'];
  unavailableTests?: UnavailableTests;
  onToggle: (id: TestId) => void;
  onNotice: (message: string) => void;
  workflowSelector?: ReactNode;
}

const TEST_GROUPS: readonly { title: string; tests: readonly [TestId, string][] }[] = [
  {
    title: 'Cable tests',
    tests: [
      ['wiremap', 'Wiremap'],
      ['tdr', 'TDR length & faults'],
      ['tdr-graph', 'TDR graph'],
      ['ber', 'Error rate / BER'],
    ],
  },
  {
    title: 'Network tests',
    tests: [
      ['poe', 'PoE'],
      ['link', 'Link'],
      ['network-discovery', 'Network Discovery'],
      ['cdp', 'CDP'],
      ['lldp', 'LLDP'],
      ['vlan', 'Incoming VLANs'],
      ['traffic', 'Observe traffic'],
      ['ipv4', 'IPv4'],
      ['ipv6', 'IPv6'],
      ['extip', 'External IP'],
      ['ping', 'Ping'],
    ],
  },
];

export function ConfigurePage({
  app,
  disabled,
  firmwareVersion,
  lastTdr,
  unavailableTests = {},
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
  const cableSettings = (
    <GeneralSettings
      lastTdr={lastTdr}
      disabled={disabled}
      settings={settings}
      onSettingsChange={app.setToolSettings}
      reportPreferences={app.reportPreferences}
      onReportPreferencesChange={app.setReportPreferences}
      onNotice={onNotice}
    />
  );
  return (
    <PageLayout
      className="settings-page configure-page"
      eyebrow="Test & report setup"
      title="Configure"
      description={
        batch
          ? 'Configure batch tests and report defaults once, then work through your cables from Test.'
          : 'Set cable and report defaults here. Choose tests and adjust network or BER controls on Test.'
      }
      headerChildren={workflowSelector}
    >
      <div className="settings-board">
        <div className="settings-column">
          <ProjectSettings
            key={app.workflowMode}
            app={app}
            disabled={disabled}
            onNotice={onNotice}
          />
          {batch && (
            <ToolPanel title="Tests to run" disabled={disabled}>
              <div className="settings-test-groups">
                {TEST_GROUPS.map((group) => (
                  <fieldset className="settings-test-selection" key={group.title}>
                    <legend className="test-group-heading">{group.title}</legend>
                    {group.tests.map(([id, title]) => {
                      const label =
                        id === 'network-discovery'
                          ? discoveryLabel(
                              app.selected,
                              app.measurementSettings.discoveryMode ?? 'active',
                            )
                          : title;
                      const requirement = unavailableTests[id];
                      return (
                        <label key={id}>
                          <Checkbox
                            size="large"
                            checked={!unavailableTests[id] && app.selected.has(id)}
                            disabled={Boolean(unavailableTests[id])}
                            onChange={() => onToggle(id)}
                          />
                          {requirement ? `${label} · ${requirement}` : label}
                        </label>
                      );
                    })}
                  </fieldset>
                ))}
              </div>
              <p className="settings-hint">
                Ping and External IP also enable IPv4. Use the wiremap adapter for Wiremap, an
                active port for network tests, and the loopback adapter for BER.
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
          {batch && cableSettings}
        </div>
        <div className="settings-column">
          <PresetSettings
            key={app.workflowMode}
            app={app}
            disabled={disabled}
            onNotice={onNotice}
          />
          {!batch && cableSettings}
          {batch && (
            <>
              <ToolPanel title="Network & discovery" disabled={disabled}>
                <NetworkSettings
                  settings={app.measurementSettings}
                  selected={app.selected}
                  firmwareVersion={firmwareVersion}
                  discoveryUnavailable={Boolean(unavailableTests['network-discovery'])}
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
              <ToolPanel
                title="Error rate / BER"
                disabled={disabled || Boolean(unavailableTests.ber)}
                summary={unavailableTests.ber}
              >
                <BerSettingsPanel
                  settings={app.measurementSettings}
                  onChange={app.setMeasurementSettings}
                />
              </ToolPanel>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
