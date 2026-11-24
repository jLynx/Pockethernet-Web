import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { BLE, PACKET, decodeCobs, encodePacket } from '@/pockethernetProtocol';
import {
  createPockethernetConnection,
  INITIAL_CONNECTION,
  type ConnectionSnapshot,
} from './pockethernetConnection';

function fixture() {
  const device = Object.assign(new EventTarget(), { id: 'test-device', name: 'Test Pockethernet' });
  const notify = Object.assign(new EventTarget(), {
    value: new DataView(new ArrayBuffer(0)),
    startNotifications: () => Promise.resolve(),
  });
  let pickerCalls = 0;
  let connectCalls = 0;
  let available = true;
  let holdConnect = false;
  let holdWrite = false;
  let finishHeldConnect: (() => void) | undefined;
  const never = new Promise<never>(() => {});
  const sent: number[] = [];
  const info = new Uint8Array(35);
  new DataView(info.buffer).setUint32(24, 32, true);

  const write = {
    writeValueWithResponse(bytes: Uint8Array) {
      const frame = decodeCobs(bytes.slice(1, -1));
      const type = new DataView(frame.buffer).getUint16(0, true);
      sent.push(type);
      if (type === PACKET.DEVICE_INFO) {
        const response = Uint8Array.from(encodePacket(type, info));
        notify.value = new DataView(response.buffer);
        notify.dispatchEvent(new Event('characteristicvaluechanged'));
      }
      return holdWrite ? never : Promise.resolve();
    },
  };
  const service = {
    getCharacteristic: (uuid: string) => Promise.resolve(uuid === BLE.notify ? notify : write),
  };
  const gatt = {
    connected: false,
    connect() {
      connectCalls++;
      if (holdConnect) {
        return new Promise<typeof this>((resolve) => {
          finishHeldConnect = () => {
            this.connected = true;
            resolve(this);
          };
        });
      }
      if (!available) return Promise.reject(new Error('Not in range'));
      this.connected = true;
      return Promise.resolve(this);
    },
    disconnect() {
      if (!this.connected) return;
      this.connected = false;
      device.dispatchEvent(new Event('gattserverdisconnected'));
    },
    getPrimaryService: () => Promise.resolve(service),
  };
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The fixture implements the Web Bluetooth methods Pocketweb calls.
  const selected = Object.assign(device, { gatt }) as unknown as BluetoothDevice;
  let snapshot: ConnectionSnapshot = INITIAL_CONNECTION;
  const controller = createPockethernetConnection(
    (state) => {
      snapshot = state;
    },
    () => {
      pickerCalls++;
      return Promise.resolve(selected);
    },
  );
  return {
    controller,
    state: () => snapshot,
    drop: () => gatt.disconnect(),
    makeUnavailable: () => {
      available = false;
    },
    holdNextConnect: () => {
      holdConnect = true;
    },
    resumeConnects: () => {
      holdConnect = false;
    },
    finishHeldConnect: () => finishHeldConnect?.(),
    gattConnected: () => gatt.connected,
    holdNextWrite: () => {
      holdWrite = true;
    },
    resumeWrites: () => {
      holdWrite = false;
    },
    counts: () => ({ pickerCalls, connectCalls }),
    sent,
  };
}

void test('a dropped link reopens the selected device and isolates the old commands', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = fixture();
  await h.controller.connect();
  const previous = h.state().commands;
  assert.ok(previous);

  const passive = assert.rejects(previous.waitFor(PACKET.PHY_LINKINFO), /disconnected/i);
  h.holdNextWrite();
  const outgoing = assert.rejects(
    previous.request({ type: PACKET.PHY_QUERY, payload: new Uint8Array() }, PACKET.PHY_QUERY),
    /disconnected/i,
  );
  await setImmediate();
  h.drop();
  h.resumeWrites();
  assert.equal(h.state().status, 'reconnecting');
  assert.equal(h.state().info, null);
  await passive;
  await outgoing;
  t.mock.timers.tick(350);
  await setImmediate();

  assert.equal(h.state().status, 'connected');
  assert.equal(h.state().info?.espVersion, 32);
  assert.deepEqual(h.counts(), { pickerCalls: 1, connectCalls: 2 });
  assert.deepEqual(h.sent, [PACKET.DEVICE_INFO, PACKET.PHY_QUERY, PACKET.DEVICE_INFO]);
  await assert.rejects(
    previous.send({ type: PACKET.ETH_STOP, payload: new Uint8Array() }),
    /not connected/,
  );
  h.controller.setBattery(previous.request, 91, false);
  assert.equal(h.state().batteryPercent, null);
  h.controller.disconnect();
  t.mock.timers.tick(10_000);
  assert.equal(h.state().status, 'disconnected');
  assert.equal(h.counts().connectCalls, 2);
});

void test('failed reconnect attempts retain idle shutdown detection on V32', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });
  const h = fixture();
  await h.controller.connect();
  t.mock.timers.tick(59 * 60_000);
  h.makeUnavailable();
  h.drop();
  for (const delay of [350, 900, 1800]) {
    t.mock.timers.tick(delay);
    await setImmediate();
  }
  assert.deepEqual(h.counts(), { pickerCalls: 1, connectCalls: 4 });
  assert.equal(h.state().status, 'disconnected');
  assert.equal(h.state().idleShutdown, true);
});

void test('firmware operations can suppress and cancel Bluetooth reconnects', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = fixture();
  await h.controller.connect();
  h.controller.setAutoReconnect(false);
  h.drop();
  t.mock.timers.tick(10_000);
  assert.equal(h.state().status, 'disconnected');
  assert.equal(h.counts().connectCalls, 1);

  h.controller.setAutoReconnect(true);
  await h.controller.connect();
  h.holdNextConnect();
  h.drop();
  t.mock.timers.tick(350);
  await setImmediate();
  assert.equal(h.state().status, 'reconnecting');
  h.controller.setAutoReconnect(false);
  t.mock.timers.tick(30_000);
  await setImmediate();
  assert.equal(h.state().status, 'disconnected');
  assert.equal(h.counts().connectCalls, 3);
});

void test('a stalled native reconnect gives the next attempt a chance', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(AbortSignal, 'timeout', (ms: number) => {
    const scope = new AbortController();
    setTimeout(() => scope.abort(), ms);
    return scope.signal;
  });
  const h = fixture();
  await h.controller.connect();
  h.holdNextConnect();
  h.drop();
  t.mock.timers.tick(350);
  await setImmediate();
  assert.equal(h.counts().connectCalls, 2);
  t.mock.timers.tick(7000);
  await setImmediate();
  h.resumeConnects();
  t.mock.timers.tick(900);
  await setImmediate();
  assert.equal(h.state().status, 'connected');
  assert.deepEqual(h.counts(), { pickerCalls: 1, connectCalls: 3 });
  h.controller.disconnect();
});

void test('cancelling a reconnect closes a native connection that arrives late', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = fixture();
  await h.controller.connect();
  h.holdNextConnect();
  h.drop();
  t.mock.timers.tick(350);
  await setImmediate();
  assert.equal(h.state().status, 'reconnecting');

  h.controller.disconnect();
  h.finishHeldConnect();
  await setImmediate();
  t.mock.timers.tick(10_000);
  assert.equal(h.state().status, 'disconnected');
  assert.equal(h.gattConnected(), false);
  assert.deepEqual(h.counts(), { pickerCalls: 1, connectCalls: 2 });
});
