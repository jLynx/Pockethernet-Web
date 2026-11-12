import type { ReactElement } from 'react';
import type { BlinkerSettings, StateSetter, TonerSettings, WifiSettings } from '@/app/types';
import { ToolControl, ToolField, ToolPanel } from './ToolControls';
import { PageHeader } from '@/shared/ui/UiPrimitives';

interface ToolsPageProps {
  firmwareLocked: boolean;
  blinkerSettings: BlinkerSettings;
  onBlinkerSettingsChange: StateSetter<BlinkerSettings>;
  onBlinkerChange: (settings: BlinkerSettings, tonerActive: boolean) => Promise<boolean>;
  tonerSettings: TonerSettings;
  onTonerSettingsChange: StateSetter<TonerSettings>;
  onTonerChange: (settings: TonerSettings, blinkerActive: boolean) => Promise<boolean>;
  wifiSettings: WifiSettings;
  onWifiSettingsChange: StateSetter<WifiSettings>;
  onWifiChange: (settings: WifiSettings) => Promise<boolean>;
}

export function ToolsPage(props: ToolsPageProps): ReactElement {
  const {
    firmwareLocked,
    blinkerSettings,
    onBlinkerSettingsChange,
    onBlinkerChange,
    tonerSettings,
    onTonerSettingsChange,
    onTonerChange,
    wifiSettings,
    onWifiSettingsChange,
    onWifiChange,
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
    const shouldApply = name === 'link' || blinkerSettings.link !== 'off';
    if (shouldApply && !(await onBlinkerChange(next, tonerSettings.power === 'on'))) return;
    onBlinkerSettingsChange(next);
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
  return (
    <main className="tools-page">
      <PageHeader
        className="tools-header"
        eyebrow="Device tools"
        title="Tools"
        description="Trace a cable, identify a port, or enable the WiFi bridge."
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
        <div className="tools-column">
          <ToolPanel
            className="tool-panel-toner"
            disabled={firmwareLocked}
            title="Tone generator"
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
            className="tool-panel-wifi"
            disabled={firmwareLocked}
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
        </div>
        <div className="tools-column">
          <ToolPanel
            className="tool-panel-blinker"
            disabled={firmwareLocked}
            title="Blink port light"
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
        </div>
      </div>
    </main>
  );
}
