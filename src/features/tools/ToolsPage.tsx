import type { ReactElement } from 'react';
import type { BlinkerSettings, StateSetter, TonerSettings, WifiSettings } from '@/app/types';
import { ToolControl, ToolField, ToolPanel } from './ToolControls';
import { PageLayout } from '@/shared/layout/PageLayout';
import { firmwareRequirement, firmwareSupports } from '@/protocol/firmwareFeatures';
import { TONER_PAIR_MASKS } from '@/protocol/commands';
import { Button, SelectField } from '@/shared/ui/UiPrimitives';

interface ToolsPageProps {
  firmwareLocked: boolean;
  firmwareVersion?: number;
  blinkerSettings: BlinkerSettings;
  onBlinkerSettingsChange: StateSetter<BlinkerSettings>;
  onBlinkerChange: (settings: BlinkerSettings, tonerActive: boolean) => Promise<boolean>;
  tonerSettings: TonerSettings;
  onTonerSettingsChange: StateSetter<TonerSettings>;
  onTonerChange: (settings: TonerSettings, blinkerActive: boolean) => Promise<boolean>;
  wifiSettings: WifiSettings;
  onWifiSettingsChange: StateSetter<WifiSettings>;
  onWifiChange: (settings: WifiSettings) => Promise<boolean>;
  bridgeSpeed?: number | null;
  onNotice?: (message: string) => void;
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
  const customMelody = tonerSettings.tone === 'melody';
  const canPlayMelody = firmwareSupports(props.firmwareVersion, 'tonerMelody');
  const pairMask = tonerSettings.pairMask ?? TONER_PAIR_MASKS[tonerSettings.pair];
  const allPairs = pairMask === TONER_PAIR_MASKS.all;
  const pairs = ['1', '2', '3', '4'] as const;
  const enabledPairs = pairs.filter((pair) => pairMask & TONER_PAIR_MASKS[pair]);
  const channel = wifiSettings.channel ?? 1;
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
    <PageLayout
      className="tools-page"
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
    >
      <div className="tools-board">
        <div className="tools-column">
          <ToolPanel
            className="tool-panel-toner"
            disabled={firmwareLocked}
            title="Tone generator"
            active={tonerSettings.power === 'on'}
            summary={
              tonerSettings.power === 'on'
                ? `${enabledPairs.length ? `Pairs ${enabledPairs.join(', ')}` : 'Shield'} · ${customMelody ? 'Custom melody' : `Tone ${tonerSettings.tone}`}`
                : 'Tone generator is off'
            }
          >
            <fieldset className="tool-control">
              <legend>Pairs</legend>
              <div className="tool-button-row">
                {pairs.map((pair) => {
                  const mask = TONER_PAIR_MASKS[pair];
                  const selected = !allPairs && Boolean(pairMask & mask);
                  return (
                    <Button
                      key={pair}
                      aria-pressed={selected}
                      variant={selected ? 'primary' : undefined}
                      onClick={() =>
                        void updateToner('pairMask', allPairs ? mask : pairMask ^ mask)
                      }
                    >
                      P{pair}
                    </Button>
                  );
                })}
                <Button
                  aria-pressed={allPairs}
                  variant={allPairs ? 'primary' : undefined}
                  onClick={() => {
                    if (!allPairs) void updateToner('pairMask', TONER_PAIR_MASKS.all);
                  }}
                >
                  All
                </Button>
              </div>
            </fieldset>
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
                ['1', 'Standard'],
                ['2', 'Warble'],
                ['3', 'Pulse'],
                ['4', 'Continuous'],
                ['melody', 'Melody'],
              ]}
              onChange={updateToner}
            />
            {customMelody && (
              <>
                <label className="tool-field tool-melody-field">
                  Melody (RTTTL)
                  <textarea
                    rows={3}
                    spellCheck={false}
                    disabled={tonerSettings.power === 'on'}
                    value={tonerSettings.melody}
                    onChange={(event) => {
                      const melody = event.target.value;
                      onTonerSettingsChange((current) => ({ ...current, melody }));
                    }}
                  />
                </label>
                {!canPlayMelody && (
                  <p className="tool-melody-requirement">{firmwareRequirement('tonerMelody')}</p>
                )}
              </>
            )}
            <ToolControl
              label="Volume"
              name="volume"
              value={tonerSettings.volume}
              options={[
                ['low', 'Low'],
                ['high', 'High'],
                ['diff', 'Diff'],
              ]}
              onChange={updateToner}
            />
            <ToolControl
              label="On/Off"
              name="power"
              value={tonerSettings.power}
              disabled={customMelody && !canPlayMelody && tonerSettings.power === 'off'}
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
            summary={
              wifiSettings.enabled !== 'on'
                ? 'Bridge disabled'
                : props.bridgeSpeed === 0
                  ? 'Ethernet link down'
                  : props.bridgeSpeed
                    ? `Ethernet link up · ${props.bridgeSpeed} Mbit/s`
                    : 'Bridge enabled · Ethernet link unknown'
            }
          >
            <ToolField
              label="WiFi name"
              disabled={wifiSettings.enabled === 'on'}
              value={wifiSettings.name}
              onChange={(event) => {
                void updateWifi('name', event.target.value.slice(0, 32));
              }}
            />
            <ToolField
              label="WiFi password"
              disabled={wifiSettings.enabled === 'on'}
              value={wifiSettings.password}
              onChange={(event) => {
                void updateWifi('password', event.target.value.slice(0, 63));
              }}
            />
            <div className="tool-button-row tool-password-actions">
              <Button
                disabled={!wifiSettings.password}
                onClick={() => {
                  void (async () => {
                    try {
                      await navigator.clipboard.writeText(wifiSettings.password);
                      props.onNotice?.('WiFi password copied.');
                    } catch {
                      props.onNotice?.('Could not copy the WiFi password.');
                    }
                  })();
                }}
              >
                Copy password
              </Button>
              <Button
                disabled={wifiSettings.enabled === 'on'}
                onClick={() => {
                  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
                  const chars = crypto.getRandomValues(new Uint8Array(12));
                  const password = Array.from(chars, (byte) => alphabet[byte & 31]).join('');
                  void updateWifi(
                    'password',
                    `${password.slice(0, 4)}-${password.slice(4, 8)}-${password.slice(8)}`,
                  );
                }}
              >
                New password
              </Button>
            </div>
            <SelectField
              className="tool-field"
              label="WiFi channel"
              value={channel}
              disabled={wifiSettings.enabled === 'on'}
              onChange={(event) => {
                void updateWifi('channel', Number(event.target.value));
              }}
            >
              {Array.from({ length: 11 }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1} ({2412 + index * 5} MHz)
                </option>
              ))}
            </SelectField>
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
    </PageLayout>
  );
}
