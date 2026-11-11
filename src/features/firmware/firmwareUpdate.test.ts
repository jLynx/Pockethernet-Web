import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { linkPacket } from '@/app/measurementFixtures';
import {
  PACKET,
  espUpdateCommand,
  parseEspUpdateStatus,
  parseFirmwareVersionResponse,
  validateOfficialFirmwareUrl,
} from '@/pockethernetProtocol';
import { createFirmwareUpdater, updateLocked, updateWorking } from './firmwareUpdateController';
import { readPendingUpdate } from './updateRecovery';
import { url, statusPacket, harness, clocked, finish, install } from './firmwareTestHarness';

const command = espUpdateCommand(url);
assert.equal(command.type, 0xf401);
assert.equal(new DataView(command.payload.buffer).getUint16(0, true), 300);
assert.equal(command.payload[2], url.length + 1);
assert.equal(new TextDecoder().decode(command.payload.slice(3, -1)), url);
assert.equal(command.payload[command.payload.length - 1], 0);
assert.equal(parseEspUpdateStatus(statusPacket(255)), 255);
assert.throws(() => parseEspUpdateStatus({ type: PACKET.ESP_UPDATE, payload: Uint8Array.of(10) }));
assert.throws(() => espUpdateCommand(`http://host/${'x'.repeat(60)}`));
assert.throws(() => espUpdateCommand('https://host/\0file'));
assert.throws(() => espUpdateCommand('https://host/é'));
for (const value of [
  '17#https://evil.test/a',
  '17#https://ota.pockethernet.com/pen_s_crypt_17.bin',
  '17#https://ota.pockethernet.com/pen_e_crypt_16.bin',
  '17#https://ota.pockethernet.com/pen_e_crypt_17.bin?x',
]) {
  const target = parseFirmwareVersionResponse(value, 16);
  assert.throws(() => validateOfficialFirmwareUrl(target.downloadUrl, target.latestVersion));
}
for (const value of [
  '#http://host/a',
  '1.5#http://host/a',
  '-1#http://host/a',
  '17#xxhttp://host/a',
])
  assert.throws(() => parseFirmwareVersionResponse(value, 16));

await clocked(async () => {
  const h = harness();
  await h.updater.check();
  h.updater.confirm();
  h.updater.cancel();
  assert.equal(h.commands.length, 0, 'Confirmation/cancellation must not send device commands');
  h.updater.confirm();
  const phases: string[] = [];
  h.updater.subscribe(() => phases.push(h.updater.getState().phase));
  const first = h.updater.start();
  await h.updater.start(); // Double click before the first command reply.
  await finish(first);
  assert.equal(h.updater.getState().phase, 'restart');
  assert.ok(updateLocked(h.updater.getState()));
  assert.equal(updateWorking(h.updater.getState()), false);
  assert.ok(
    phases.includes('dhcp') && phases.includes('settling') && phases.includes('installing'),
  );
  const config = h.commands.find(({ packet }) => packet.type === PACKET.ETH_CONFIG);
  const ota = h.commands.filter(({ packet }) => packet.type === PACKET.ESP_UPDATE);
  assert.ok(config);
  assert.equal(ota.length, 1);
  assert.ok(ota[0].at - config.at >= 10000, 'Stock DHCP readiness delay must not be removed');
  const view = new DataView(config.packet.payload.buffer);
  assert.equal(view.getUint16(0, true), 9);
  assert.equal(view.getUint16(2, true), 3);
  assert.equal(view.getUint32(4, true), 1773);
  assert.ok(
    config.packet.payload.slice(8).every((value) => value === 0),
    'Use untagged Ethernet and factory MAC',
  );
  await h.updater.start();
  h.setInfo(17);
  h.client.status = 'disconnected';
  await h.updater.verify();
  assert.equal(h.updater.getState().phase, 'verified');
  assert.equal(updateLocked(h.updater.getState()), false);
  assert.equal(readPendingUpdate(h.storage), null);
});

for (const code of [0, 1, 3, 11, 12, 13, 14, 15, 16, 255, 256])
  await clocked(async () => {
    const h = harness(code);
    await install(h);
    const unknown = [0, 255, 256].includes(code);
    assert.equal(h.updater.getState().phase, unknown ? 'unknown' : 'failed');
    assert.match(h.updater.getState().message, new RegExp(`code ${code}`));
    assert.equal(
      h.commands.some(({ packet }) => packet.type === PACKET.ETH_STOP),
      !unknown,
    );
    assert.equal(!!readPendingUpdate(h.storage), unknown);
  });

for (const mode of [
  'link',
  'dhcp',
  'nack',
  'disconnect',
  'write',
  'malformed',
  'timeout',
  'ota-nack',
] as const)
  await clocked(async () => {
    const h = harness();
    h.setResponder((packet) => {
      if (packet.type === PACKET.ETH_CONFIG && ['link', 'dhcp', 'nack'].includes(mode)) {
        h.inbox.receive({
          type: mode === 'nack' ? PACKET.NACK : PACKET.ACK,
          payload: new Uint8Array(),
        });
        if (mode === 'dhcp') h.inbox.receive(linkPacket());
      } else if (packet.type === PACKET.ESP_UPDATE) {
        if (mode === 'ota-nack') h.inbox.receive({ type: PACKET.NACK, payload: new Uint8Array() });
        if (mode === 'disconnect') {
          h.inbox.cancel();
          h.updater.disconnected();
        } else if (mode === 'write') throw new Error('GATT write failed');
        else if (mode === 'malformed')
          h.inbox.receive({ type: PACKET.ESP_UPDATE, payload: Uint8Array.of(10) });
      } else h.defaultRespond(packet);
    });
    await install(h);
    const unknown = !['link', 'dhcp', 'nack', 'ota-nack'].includes(mode);
    assert.equal(h.updater.getState().phase, unknown ? 'unknown' : 'failed');
    assert.equal(
      h.commands.some(({ packet }) => packet.type === PACKET.ESP_UPDATE),
      unknown || mode === 'ota-nack',
    );
    assert.equal(
      h.commands.some(({ packet }) => packet.type === PACKET.ETH_STOP),
      !unknown,
    );
  });

await clocked(async () => {
  const h = harness();
  await h.updater.check();
  h.block();
  h.updater.confirm();
  assert.equal(h.updater.getState().phase, 'failed');
  assert.equal(h.commands.length, 0);
});
await clocked(async () => {
  const h = harness();
  await h.updater.check();
  h.updater.confirm();
  h.setInfo(17); // Same device changed version after confirmation.
  await finish(h.updater.start());
  assert.equal(h.updater.getState().phase, 'failed');
  assert.equal(h.commands.length, 1);
});
await clocked(async () => {
  const h = harness();
  h.storage.setItem = () => {
    throw new Error('Browser storage unavailable');
  };
  await install(h);
  assert.equal(h.updater.getState().phase, 'failed');
  assert.equal(
    h.commands.some(({ packet }) => packet.type === PACKET.ESP_UPDATE),
    false,
  );
});
await clocked(async () => {
  const h = harness();
  await install(h);
  h.setInfo(17, 17, 999);
  await h.updater.verify();
  assert.match(h.updater.getState().message, /different device/);
  h.setInfo(17, 18);
  await h.updater.verify();
  assert.match(h.updater.getState().message, /STM firmware version changed/);
  h.setInfo(16);
  await h.updater.verify();
  assert.match(h.updater.getState().message, /expected v17/);
  assert.ok(updateLocked(h.updater.getState()));
});
await clocked(async () => {
  const h = harness(255);
  await install(h);
  const recovered = createFirmwareUpdater({
    getClient: () => h.client,
    getBlockedReason: () => '',
    storage: h.storage,
    onLockChange: () => {},
  });
  assert.equal(recovered.getState().phase, 'unknown');
  const count = h.commands.length;
  await recovered.start();
  await recovered.check();
  await recovered.verify();
  assert.equal(
    h.commands.length,
    count,
    'Recovery must not send commands while the worker may be active',
  );
  mock.timers.tick(310000);
  h.setInfo(16);
  await recovered.verify(); // Explicit user confirmation that the device was restarted.
  assert.equal(recovered.getState().phase, 'failed');
  assert.equal(updateLocked(recovered.getState()), false);
  assert.equal(readPendingUpdate(h.storage), null);
});
await clocked(async () => {
  const h = harness();
  h.setResponder((packet) => {
    h.defaultRespond(packet);
    if (packet.type === PACKET.ETH_CONFIG)
      setTimeout(() => {
        h.inbox.cancel();
        h.updater.disconnected();
      }, 1000);
  });
  await install(h);
  assert.equal(h.updater.getState().phase, 'failed');
  assert.equal(
    h.commands.some(({ packet }) => packet.type === PACKET.ESP_UPDATE),
    false,
  );
});
await clocked(async () => {
  const h = harness();
  h.setResponder((packet) => {
    if (packet.type !== PACKET.ETH_STOP) h.defaultRespond(packet);
  });
  await install(h);
  assert.equal(
    h.updater.getState().phase,
    'restart',
    'A missing cleanup ACK must not undo status 10',
  );
  const recovered = createFirmwareUpdater({
    getClient: () => h.client,
    getBlockedReason: () => '',
    storage: h.storage,
    onLockChange: () => {},
  });
  assert.equal(recovered.getState().phase, 'restart');
  assert.equal(recovered.getState().pending?.completed, true);
});
await clocked(async () => {
  const h = harness();
  h.setResponder((packet) => {
    if (packet.type === PACKET.ESP_UPDATE) setTimeout(() => h.updater.dispose(), 1000);
    else h.defaultRespond(packet);
  });
  await install(h);
  assert.ok(readPendingUpdate(h.storage), 'Closing the UI must preserve pending OTA recovery');
  assert.equal(
    h.commands.some(({ packet }) => packet.type === PACKET.ETH_STOP),
    false,
  );
});
console.log(
  'Firmware update protocol, readiness, failure, recovery and version verification tests passed.',
);
