import assert from 'node:assert/strict';
import { parseDeviceInfo } from '@/pockethernetProtocol';
import { loadImages, loadManifest } from './usb/firmware';
import { createFirmwareUpdater, updateWorking } from './firmwareUpdateController';
import { harness, infoPayload, latest, usbManifest } from './firmwareTestHarness';
import { checkOfficialFirmware } from './officialFirmware';
import { runUsbFirmwareUpdate, UsbReleaseChangedError } from './runUsbFirmwareUpdate';
import { readPendingUpdate } from './updateRecovery';

const loadUsbManifest = () => Promise.resolve(usbManifest(32));
const fetchLatest = () => Promise.resolve(new Response(latest));
const unavailable = () => Promise.reject(new Error('Server unavailable'));
const device = parseDeviceInfo(infoPayload(17));

const preferred = await checkOfficialFirmware(device, loadUsbManifest, fetchLatest);
assert.ok('method' in preferred && preferred.method === 'usb' && preferred.updateAvailable);
assert.equal(preferred.latestVersion, 32);
const newerOta = await checkOfficialFirmware(device, loadUsbManifest, () =>
  Promise.resolve(new Response('33#https://ota.pockethernet.com/pen_e_crypt_33.bin')),
);
assert.ok('method' in newerOta && newerOta.method === 'ethernet' && newerOta.updateAvailable);
const fallback = await checkOfficialFirmware(
  { ...device, espVersion: 16 },
  unavailable,
  fetchLatest,
);
assert.ok('method' in fallback && fallback.method === 'ethernet' && fallback.updateAvailable);
assert.match(fallback.warning ?? '', /Could not check for USB updates/);
const incomplete = await checkOfficialFirmware(device, unavailable, fetchLatest);
assert.ok('error' in incomplete);
const partial = await checkOfficialFirmware(
  { ...device, espVersion: 32 },
  loadUsbManifest,
  fetchLatest,
);
assert.ok('method' in partial && partial.method === 'usb' && partial.updateAvailable);
for (const espVersion of [32, 33]) {
  const current = await checkOfficialFirmware(
    { ...device, espVersion, stmVersion: 32 },
    loadUsbManifest,
    fetchLatest,
  );
  assert.ok('updateAvailable' in current && !current.updateAvailable);
}

let attempts = 0;
const h = harness(10, undefined, {
  loadUsbManifest,
  runUsb: ({ version, mode, onStage, onProgress, onWriteStarting }) => {
    assert.equal(version, 32);
    assert.ok(updateWorking(h.updater.getState()));
    onStage('Waiting for USB device');
    attempts++;
    if (attempts === 1) return Promise.resolve('cancelled');
    assert.equal(mode, attempts === 2 ? 'fast' : 'backup');
    onWriteStarting();
    assert.equal(readPendingUpdate(h.storage)?.target.method, 'usb');
    onProgress(0.5);
    assert.equal(h.updater.getState().usbProgress, 50);
    return attempts === 2
      ? Promise.reject(new Error('USB disconnected'))
      : Promise.resolve('complete');
  },
});
await h.updater.check();
h.client.status = 'disconnected';
h.client.info = null;
h.updater.disconnected();
h.updater.confirm();
assert.equal(h.updater.getState().phase, 'confirm', 'The USB offer must survive power-off');
const first = h.updater.start();
await h.updater.start();
await first;
assert.equal(attempts, 1);
assert.equal(h.updater.getState().phase, 'confirm');
assert.equal(readPendingUpdate(h.storage), null);

await h.updater.start();
assert.equal(h.updater.getState().phase, 'unknown');
const recovered = createFirmwareUpdater({
  getClient: () => h.client,
  getBlockedReason: () => '',
  storage: h.storage,
  onLockChange: () => {},
});
assert.equal(recovered.getState().phase, 'unknown');
assert.equal(recovered.getState().pending?.target.method, 'usb');
assert.equal(h.commands.length, 0, 'USB update must not send Bluetooth OTA commands');
await h.updater.start();
assert.equal(h.updater.getState().phase, 'restart');
assert.equal(readPendingUpdate(h.storage)?.completed, true);
h.setInfo(32, 32, 999);
await h.updater.verify();
assert.match(h.updater.getState().message, /different device/);
h.setInfo(32, 17);
await h.updater.verify();
assert.equal(h.updater.getState().phase, 'unknown');
assert.match(h.updater.getState().message, /Expected 32\.32/);
h.setInfo(32, 32);
await h.updater.verify();
assert.equal(h.updater.getState().phase, 'verified');
assert.equal(readPendingUpdate(h.storage), null);

const storageFailure = harness(10, undefined, {
  loadUsbManifest,
  runUsb: ({ onWriteStarting }) => {
    onWriteStarting();
    assert.fail('Do not write USB firmware when recovery could not be saved');
  },
});
storageFailure.storage.setItem = () => {
  throw new Error('Storage unavailable');
};
await storageFailure.updater.check();
storageFailure.updater.confirm();
await storageFailure.updater.start();
assert.match(storageFailure.updater.getState().message, /Storage unavailable/);
assert.equal(storageFailure.updater.getState().phase, 'failed');

const originalFetch = globalThis.fetch;
const packageManifest = usbManifest(32);
const [esp, espAux, stm] = packageManifest.files.map(({ size }) => new Uint8Array(size));
const header = new DataView(stm.buffer);
header.setUint32(0, 0x50455549);
header.setUint32(8, stm.length - 128, true);
header.setUint32(16, 1, true);
header.setUint32(20, 32, true);
const files = new Map(
  packageManifest.files.map(({ file }, i) => [
    new URL(file, packageManifest.source).href,
    [esp, espAux, stm][i],
  ]),
);
try {
  globalThis.fetch = (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const bytes = files.get(url);
    return Promise.resolve(bytes ? new Response(bytes) : Response.json(packageManifest));
  };
  for (const descriptor of packageManifest.files) {
    const bytes = files.get(new URL(descriptor.file, packageManifest.source).href);
    assert.ok(bytes);
    descriptor.sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
  }
  const manifest = await loadManifest(packageManifest.source);
  const images = await loadImages(manifest, () => {});
  assert.deepEqual(images.stm, stm);
  esp[0] = 1;
  await assert.rejects(
    loadImages(manifest, () => {}),
    /failed its SHA-256 check/,
  );
  esp[0] = 0;
  header.setUint32(20, 31, true);
  manifest.files[2].sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', stm)).toString(
    'hex',
  );
  await assert.rejects(
    loadImages(manifest, () => {}),
    /matching STM firmware image/,
  );
} finally {
  globalThis.fetch = originalFetch;
}

let picked = false;
let cancelled = true;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { isSecureContext: true },
});
Object.defineProperty(navigator, 'serial', {
  configurable: true,
  value: {
    requestPort() {
      picked = true;
      return cancelled
        ? Promise.reject(new DOMException('No device selected', 'NotFoundError'))
        : Promise.resolve({ getInfo: () => ({ usbVendorId: 0x120b, usbProductId: 0xc919 }) });
    },
  },
});
const run = (loadManifest: typeof loadUsbManifest) =>
  runUsbFirmwareUpdate({
    version: 32,
    mode: 'fast',
    loadManifest,
    onStage: () => {},
    onProgress: () => {},
    onWriteStarting: () =>
      assert.fail('Cannot write firmware before the picker and release checks'),
  });
try {
  const opening = run(() => assert.fail('A cancelled picker must not fetch the update'));
  assert.equal(picked, true, 'The picker must open synchronously on the click');
  assert.equal(await opening, 'cancelled');
  cancelled = false;
  await assert.rejects(
    run(() => Promise.resolve(usbManifest(33))),
    UsbReleaseChangedError,
  );
} finally {
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(navigator, 'serial');
}
