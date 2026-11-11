import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { PACKET, poeCommand } from '@/pockethernetProtocol';
import {
  createPacketInbox,
  DeviceRejectedError,
  DeviceTimeoutError,
  requestPacket,
} from './packetInbox';
import { deferredStart } from '@/app/runNetworkMeasurements';
import { linkPacket } from '@/app/measurementFixtures';

mock.timers.enable({ apis: ['setTimeout'] });
try {
  const inbox = createPacketInbox();
  const ack = { type: PACKET.ACK, payload: new Uint8Array() };
  const poe = { type: PACKET.POE, payload: new Uint8Array(32) };
  const nack = { type: PACKET.NACK, payload: new Uint8Array() };

  // A passive link listener registered first must not steal a config command's NACK.
  const scope = new AbortController();
  const passive = inbox.waitFor(PACKET.PHY_LINKINFO, 10000, {
    signal: scope.signal,
    rejectNack: false,
  });
  const command = inbox.waitFor(PACKET.ACK, 2000);
  const rejected = assert.rejects(command, DeviceRejectedError);
  inbox.receive(nack);
  await rejected;
  assert.equal(inbox.busy, true);
  const cancelled = assert.rejects(passive, /cancelled/);
  scope.abort();
  await cancelled;
  assert.equal(inbox.busy, false);

  // Reply deadline is 15 seconds, including responses too late for the old 12 second limit.
  const delayed = inbox.waitFor(PACKET.POE, 15000);
  mock.timers.tick(14999);
  inbox.receive(poe);
  assert.equal(await delayed, poe);
  const timeout = assert.rejects(inbox.waitFor(PACKET.POE, 15000), DeviceTimeoutError);
  mock.timers.tick(15000);
  await timeout;
  assert.equal(inbox.busy, false);
  inbox.receive(poe); // Late response must not resurrect a timed-out listener.
  const next = inbox.waitFor(PACKET.ACK, 5000);
  inbox.receive(poe); // Nor satisfy a different command's waiter.
  assert.equal(inbox.busy, true);
  inbox.receive(ack);
  assert.equal(await next, ack);

  // Two collectors on the filter channel both receive frames, without stealing responses.
  const ready = deferredStart();
  const options = { startAfter: ready.promise };
  const first = inbox.collectFor(PACKET.POE, 30000, options);
  const second = inbox.collectFor(PACKET.POE, 30000, options);
  inbox.receive(poe);
  mock.timers.tick(60000); // Configuration hasn't completed; collection clock is not running yet.
  assert.equal(inbox.busy, true);
  ready.start();
  await Promise.resolve();
  mock.timers.tick(29999);
  assert.equal(inbox.busy, true);
  inbox.receive(poe);
  mock.timers.tick(1);
  assert.deepEqual(await first, [poe, poe]);
  assert.deepEqual(await second, [poe, poe]);
  assert.equal(inbox.busy, false);

  const up = inbox.waitFor(PACKET.PHY_LINKINFO, 10000, {
    accept: (packet) => packet.payload[10] !== 0,
  });
  inbox.receive(linkPacket(false));
  assert.equal(inbox.busy, true);
  const linked = linkPacket();
  inbox.receive(linked);
  assert.equal(await up, linked);

  // A synchronous reply during a write is accepted because request subscribes first.
  const reply = await requestPacket(
    inbox,
    () => {
      inbox.receive(poe);
      return Promise.resolve();
    },
    poeCommand(),
    PACKET.POE,
  );
  assert.equal(reply, poe);
  await assert.rejects(
    requestPacket(inbox, () => Promise.reject(new Error('Write failed')), poeCommand(), PACKET.POE),
    /Write failed/,
  );
  assert.equal(inbox.busy, false); // Failed writes must remove their pending reply listener.

  const disconnectedWait = assert.rejects(inbox.waitFor(PACKET.POE), /disconnected/);
  const disconnectedCollection = assert.rejects(inbox.collectFor(PACKET.POE), /disconnected/);
  inbox.cancel();
  await Promise.all([disconnectedWait, disconnectedCollection]);
  assert.equal(inbox.busy, false);
} finally {
  mock.timers.reset();
}
console.log('Packet inbox regression tests passed.');
