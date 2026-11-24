import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_BLINKER_SETTINGS,
  DEFAULT_TONER_SETTINGS,
  DEFAULT_WIFI_SETTINGS,
} from '@/app/storage';
import { PACKET, tonerMelodyCommand, tonerStopCommand } from '@/pockethernetProtocol';
import { ToolsPage } from './ToolsPage';

const custom = 'Chime: d=8, o=6, b=120 : c, 4d#.7, 16p, h.';
const command = tonerMelodyCommand(custom, '2', 'on', 'high');
assert.equal(command.type, 0xf221);
const header = new DataView(command.payload.buffer);
assert.deepEqual(
  [0, 4, 8, 12, 16].map((offset) => header.getUint32(offset, true)),
  [17, 1, 15, 31_250, 5],
);
assert.deepEqual([...command.payload.slice(20)], [84, 8, 99, 24, 0, 4, 95, 12, 0, 48]);
assert.deepEqual(tonerStopCommand('melody'), {
  type: PACKET.ANA_TONER,
  payload: new Uint8Array(20),
});

const maximum = Array(63).fill('c').join(',');
const full = tonerMelodyCommand(`Maximum::${maximum}`, 'all', 'off', 'low');
assert.equal(full.payload.length, 20 + 64 * 2);
assert.equal(full.payload[4], 0);
assert.throws(() => tonerMelodyCommand(`Too long::${maximum},c`, 'all', 'off', 'low'), /63 notes/);
assert.throws(() => tonerMelodyCommand('Bad:d=8:c,z', 'all', 'off', 'low'), /Invalid RTTTL note 2/);
assert.throws(() => tonerMelodyCommand('Bad:b=0:c', 'all', 'off', 'low'), /tempo/);

function render(firmwareVersion: number, power: 'off' | 'on' = 'off'): string {
  const succeed = () => Promise.resolve(true);
  return renderToStaticMarkup(
    createElement(ToolsPage, {
      firmwareLocked: false,
      firmwareVersion,
      blinkerSettings: DEFAULT_BLINKER_SETTINGS,
      onBlinkerSettingsChange: () => {},
      onBlinkerChange: succeed,
      tonerSettings: { ...DEFAULT_TONER_SETTINGS, tone: 'melody', power },
      onTonerSettingsChange: () => {},
      onTonerChange: succeed,
      wifiSettings: DEFAULT_WIFI_SETTINGS,
      onWifiSettingsChange: () => {},
      onWifiChange: succeed,
    }),
  );
}

assert.match(render(17), /Requires firmware V32\+/);
assert.match(render(17), /<fieldset class="tool-control" disabled=""><legend>On\/Off/);
assert.match(render(32), /Melody \(RTTTL\)/);
assert.match(render(32), /<fieldset class="tool-control"><legend>On\/Off/);
assert.match(render(32, 'on'), /<textarea[^>]+disabled=/);
assert.match(render(17, 'on'), /<fieldset class="tool-control"><legend>On\/Off/);
