import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FirmwareUpdatePanel } from './FirmwareUpdatePanel';
import type { FirmwareUpdateState } from './firmwareUpdateController';

const deviceInfo = {
  serial: 104716,
  hardwareVersion: 2,
  stmVersion: 17,
  espVersion: 16,
  mac: 'f4:65:0b:a3:2c:a3',
};
const state: FirmwareUpdateState = {
  phase: 'idle',
  checking: false,
  verifying: false,
  message: '',
  pending: null,
  advanced: false,
  selecting: false,
  selection: null,
  check: {
    latestVersion: 17,
    downloadUrl: 'https://ota.pockethernet.com/pen_e_crypt_17.bin',
    updateAvailable: true,
    message: 'Update available: v17',
  },
};
function render(
  patch: Partial<FirmwareUpdateState> = {},
  connected = true,
  blockedReason = '',
): string {
  return renderToStaticMarkup(
    createElement(FirmwareUpdatePanel, {
      deviceInfo: connected ? deviceInfo : null,
      updater: {
        state: { ...state, ...patch },
        blockedReason,
        check: () => Promise.resolve(),
        confirm: () => {},
        cancel: () => {},
        start: () => Promise.resolve(),
        verify: () => Promise.resolve(),
        openAdvanced: () => {},
        closeAdvanced: () => {},
        chooseUrl: () => {},
        chooseFile: () => Promise.resolve(),
      },
    }),
  );
}
const offer = render();
assert.match(offer, /Update available: v17/);
assert.match(offer, />Update<\/button>/);
assert.doesNotMatch(offer, /Check for upgrade|ESP|Install the official|Update firmware/);
assert.doesNotMatch(
  render({
    check: {
      ...state.check,
      latestVersion: 16,
      downloadUrl: '',
      updateAvailable: false,
      message: 'Already running latest software: v16',
    },
  }),
  />Update<\/button>/,
);
const confirm = render({ phase: 'confirm' });
assert.match(confirm, /Start update/);
assert.match(confirm, /Update to v17\?/);
assert.match(confirm, /Internet-connected Ethernet switch/);
assert.match(confirm, /restart Pockethernet once the update finishes/);
assert.doesNotMatch(
  confirm,
  /Check for upgrade|Update available|ESP|custom firmware|download host/,
);
assert.match(confirm, /Cancel/);
const installing = render({ phase: 'installing' });
assert.match(installing, /role="progressbar" aria-label="Firmware update in progress"/);
assert.doesNotMatch(installing, /aria-valuenow/);
assert.doesNotMatch(installing, /Start update|Cancel|Check for upgrade|\d+%/);
const restart = render({ phase: 'restart', message: 'Restart Pockethernet to finish' }, false);
assert.match(restart, /I have restarted · verify firmware/);
assert.match(restart, /Unplug USB/);
const unknown = render({ phase: 'unknown', message: 'Result unknown' }, false);
assert.match(unknown, /at least five minutes/);
assert.doesNotMatch(unknown, /Update firmware|Start update/);
const blocked = render({}, true, 'Turn off the WiFi bridge first.');
assert.match(blocked, /Turn off the WiFi bridge first/);
assert.match(blocked, /disabled=""[^>]*>Update<\/button>/);
assert.doesNotMatch(render(), /Shift-click|Advanced OTA|Advanced ESP update/);
const advanced = render({ advanced: true });
assert.match(advanced, /Advanced ESP update/);
assert.match(advanced, /Expected ESP version after boot/);
assert.match(advanced, /Review URL update/);
const custom = render({
  phase: 'confirm',
  advanced: true,
  selection: {
    source: 'file',
    latestVersion: 16,
    downloadUrl: '',
    updateAvailable: true,
    message: '',
    label: 'custom16.bin',
    bytes: 1276736,
  },
});
assert.match(custom, /custom16.bin/);
assert.match(custom, /Upload and start update/);
assert.match(custom, /30 minutes/);
assert.match(custom, /version number alone cannot distinguish/);
assert.doesNotMatch(custom, /This installs official ESP/);
console.log(
  'Firmware update availability, confirmation, progress and recovery display tests passed.',
);
