import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { inspectOtaContainer, OTA_FILE_MAX_BYTES } from '@/protocol/otaContainer';
import { PACKET, espUpdateCommand } from '@/pockethernetProtocol';
import { clocked, finish, harness } from './firmwareTestHarness';
import { createFirmwareUpdater, updateLocked } from './firmwareUpdateController';
import { readPendingUpdate } from './updateRecovery';
import { otaDownloadOrigin, uploadOtaFile } from './uploadOtaFile';

/** Synthetic container shape; it is deliberately not a flashable/authenticated firmware. */
export function otaFixture(version = 16, imageType = 2, size = 131200): ArrayBuffer {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x50455549, false);
  view.setUint32(8, size - 128, true);
  view.setUint32(0x10, imageType, true);
  view.setUint32(0x14, version, true);
  view.setUint32(0x20, 1, true);
  for (let i = 128; i < size; i++) bytes[i] = i & 255;
  return bytes.buffer;
}
const fixture = otaFixture();
const info = await inspectOtaContainer(fixture);
assert.equal(info.version, 16);
assert.equal(info.bytes, fixture.byteLength);
assert.equal(info.sha256.length, 64);
await assert.rejects(inspectOtaContainer(otaFixture(17, 1)), /STM/);
await assert.rejects(inspectOtaContainer(new ArrayBuffer(416)), /PEUI/);
await assert.rejects(inspectOtaContainer(otaFixture(0)), /invalid header/);
await assert.rejects(inspectOtaContainer(otaFixture(16, 2, OTA_FILE_MAX_BYTES + 1)), /4 MiB/);
assert.equal(otaDownloadOrigin('https://pockethernet.jlynx.net'), 'https://pockethernet.jlynx.net');
for (const host of [
  'http://localhost:5173',
  'http://127.0.0.1:8787',
  'http://[::1]',
  'https://example.test/path',
  'https://user:password@example.test',
  `https://${'a'.repeat(45)}.test`,
])
  assert.throws(() => otaDownloadOrigin(host));
for (const address of ['https://user:pass@example.test/fw.bin', 'https://example.test/fw.bin#x'])
  assert.throws(() => espUpdateCommand(address));

for (const version of [16, 15])
  await clocked(async () => {
    const h = harness();
    h.updater.openAdvanced();
    h.updater.chooseUrl('http://192.168.1.161:8765/fw.bin', version);
    assert.equal(h.updater.getState().phase, 'confirm');
    assert.equal(h.commands.length, 0, 'Reviewing a URL must not start an update');
    await finish(h.updater.start());
    assert.equal(h.updater.getState().phase, 'restart');
    const ota = h.commands.find(({ packet }) => packet.type === PACKET.ESP_UPDATE);
    assert.ok(ota);
    assert.equal(
      new TextDecoder().decode(ota.packet.payload.slice(3, -1)),
      'http://192.168.1.161:8765/fw.bin',
    );
    assert.equal(readPendingUpdate(h.storage)?.target.source, 'url');
    h.setInfo(version);
    await h.updater.verify();
    assert.equal(h.updater.getState().phase, 'verified');
    if (version === 16)
      assert.match(h.updater.getState().message, /build identity cannot be verified/);
    assert.ok(h.commands.every(({ packet }) => packet.type !== 0xf400));
    assert.equal(h.inbox.busy, false);
  });
await clocked(async () => {
  const h = harness(255);
  h.updater.openAdvanced();
  h.updater.chooseUrl('https://example.test/fw.bin', 16);
  await finish(h.updater.start());
  mock.timers.tick(310000);
  await h.updater.verify();
  assert.equal(h.updater.getState().phase, 'unconfirmed');
  assert.match(h.updater.getState().message, /installation could not be confirmed/);
  assert.equal(updateLocked(h.updater.getState()), false);
});
await clocked(async () => {
  let uploads = 0;
  const h = harness(10, (file, metadata, origin) => {
    uploads++;
    assert.equal(file.name, 'custom.bin');
    assert.deepEqual(metadata, info);
    assert.equal(origin, 'https://pockethernet.jlynx.net');
    return Promise.resolve(`${origin}/f/${'a'.repeat(22)}`);
  });
  h.updater.openAdvanced();
  await h.updater.chooseFile(new File([fixture], 'custom.bin'), 'https://pockethernet.jlynx.net');
  assert.equal(h.updater.getState().phase, 'confirm');
  assert.equal(uploads, 0, 'File inspection must not upload before confirmation');
  assert.equal(h.commands.length, 0);
  await finish(h.updater.start());
  assert.equal(uploads, 1);
  assert.equal(h.updater.getState().phase, 'restart');
  const pending = readPendingUpdate(h.storage);
  assert.equal(pending?.target.source, 'file');
  assert.equal(pending?.target.sha256, info.sha256);
  const recovered = createFirmwareUpdater({
    getClient: () => h.client,
    getBlockedReason: () => '',
    storage: h.storage,
    onLockChange: () => {},
  });
  assert.equal(recovered.getState().selection?.source, 'file');
  await h.updater.verify();
  assert.equal(h.updater.getState().phase, 'verified');
});
await clocked(async () => {
  const h = harness(10, () => Promise.reject(new Error('Upload failed')));
  h.updater.openAdvanced();
  await h.updater.chooseFile(new File([fixture], 'custom.bin'), 'https://pockethernet.jlynx.net');
  await finish(h.updater.start());
  assert.equal(h.updater.getState().phase, 'failed');
  assert.equal(h.commands.length, 0, 'Upload failure must not configure or flash the device');
  assert.equal(readPendingUpdate(h.storage), null);
});
await clocked(async () => {
  const h = harness();
  h.updater.openAdvanced();
  for (const [url, version] of [
    ['file://firmware.bin', 16],
    ['http://host/fw.bin', 0],
    ['http://host/fw.bin', 1.5],
  ] as const) {
    h.updater.chooseUrl(url, version);
    assert.equal(h.updater.getState().phase, 'failed');
  }
  await h.updater.chooseFile(
    new File([otaFixture(16, 1)], 'stm.bin'),
    'https://pockethernet.jlynx.net',
  );
  assert.match(h.updater.getState().message, /STM/);
  assert.equal(h.commands.length, 0);
  h.updater.closeAdvanced();
  assert.equal(h.updater.getState().advanced, false);
});

const originalFetch = globalThis.fetch;
try {
  const file = new File([fixture], 'custom.bin');
  globalThis.fetch = (input, init) => {
    assert.equal(input, '/api/ota-files');
    assert.equal(init?.body, file);
    return Promise.resolve(
      Response.json({
        ...info,
        path: `/f/${'x'.repeat(22)}`,
        expiresAt: Date.now() + 30 * 60 * 1000,
      }),
    );
  };
  const hosted = await uploadOtaFile(
    file,
    info,
    'https://pockethernet.jlynx.net',
    new AbortController().signal,
  );
  assert.equal(hosted.length <= 60, true);
  for (const patch of [
    { sha256: 'wrong' },
    { version: 17 },
    { path: '/file/long-invalid-link' },
    { expiresAt: 0 },
  ]) {
    globalThis.fetch = () =>
      Promise.resolve(
        Response.json({
          ...info,
          path: `/f/${'x'.repeat(22)}`,
          expiresAt: Date.now() + 30 * 60 * 1000,
          ...patch,
        }),
      );
    await assert.rejects(
      uploadOtaFile(file, info, 'https://pockethernet.jlynx.net', new AbortController().signal),
      /could not be verified/,
    );
  }
} finally {
  globalThis.fetch = originalFetch;
}
console.log(
  'Advanced URL/file OTA, same-version/downgrade, upload integrity and recovery tests passed.',
);
