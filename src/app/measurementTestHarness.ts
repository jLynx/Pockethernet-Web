import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { mock } from 'node:test';
import { createPacketInbox, requestPacket } from '@/device/packetInbox';
import { PACKET, type Packet } from '@/pockethernetProtocol';
import { captureRun, type RunSnapshot } from '@/features/notifications/measurementNotifications';
import { DEFAULT_TOOL_SETTINGS } from './storage';
import type { MeasurementContext } from './runMeasurements';
import type { MeasurementFailures, TestId } from './types';
import {
  crossPayload,
  dhcpPayload,
  dhcpv6Payload,
  linkPacket,
  lldpPayload,
  pingPayload,
  raPayload,
  tdrPayload,
  trafficPayload,
} from './measurementFixtures';

export function measurementHarness(selected: TestId[]): {
  context: MeasurementContext;
  snapshot: RunSnapshot;
  requests: { command: Packet; timeout: number }[];
  sent: Packet[];
  inbox: ReturnType<typeof createPacketInbox>;
  failures: MeasurementFailures;
  expanded: Set<TestId>;
  active: (TestId | null)[];
  running: boolean[];
  setResponder: (handler: (command: Packet) => void) => void;
  respond: (command: Packet) => void;
} {
  const inbox = createPacketInbox();
  const snapshot: RunSnapshot = { results: {}, error: '' };
  const failures: MeasurementFailures = {};
  const requests: { command: Packet; timeout: number }[] = [];
  const sent: Packet[] = [];
  let expanded = new Set<TestId>();
  const active: (TestId | null)[] = [];
  const running: boolean[] = [];
  const noop = (): void => {};
  const unsupported = (): Promise<never> => Promise.reject(new Error('Unexpected operation'));
  const notify = (type: number, payload = new Uint8Array()): void =>
    inbox.receive({ type, payload });
  const respond = (command: Packet): void => {
    const view = new DataView(
      command.payload.buffer,
      command.payload.byteOffset,
      command.payload.byteLength,
    );
    switch (command.type) {
      case PACKET.ETH_CONFIG:
        // Deliberately send notifications BEFORE the command ACK to cover the lost-reply bug.
        inbox.receive(linkPacket(false));
        inbox.receive(linkPacket());
        if (view.getUint16(2, true) & 2) notify(PACKET.DHCPV4_ACK, dhcpPayload());
        if (view.getUint16(2, true) & 16) notify(PACKET.SLAAC_ACK, raPayload);
        if (view.getUint16(2, true) & 32) notify(PACKET.DHCPV6_ACK, dhcpv6Payload);
        if (view.getUint16(0, true) & 32) notify(PACKET.ETH_FILTER_MATCH, lldpPayload);
        if (view.getUint16(0, true) & 256) notify(PACKET.VLAN_COLLECT, Uint8Array.of(100, 0xb0));
        notify(PACKET.ACK);
        break;
      case PACKET.ETH_FILTER_ADD:
        notify(PACKET.ACK);
        notify(PACKET.ETH_FILTER_MATCH, trafficPayload);
        break;
      case PACKET.ETH_STOP:
        notify(PACKET.ACK);
        break;
      case PACKET.WIREMAP:
        notify(command.type, new Uint8Array(144));
        break;
      case PACKET.TDR_SAME:
        notify(command.type, tdrPayload);
        break;
      case PACKET.TDR_CROSS:
        notify(command.type, crossPayload);
        break;
      case PACKET.POE:
        notify(command.type, new Uint8Array(32));
        break;
      case PACKET.PING:
        notify(command.type, pingPayload());
        break;
      case PACKET.HTTP_RESPONSE:
        notify(
          command.type,
          new TextEncoder().encode('{"status":"success","query":"198.51.100.7"}'),
        );
        break;
      case PACKET.BER: {
        const payload = new Uint8Array(12);
        const result = new DataView(payload.buffer);
        result.setUint32(0, view.getUint32(0, true), true);
        result.setUint32(4, view.getUint32(0, true), true);
        notify(command.type, payload);
        break;
      }
      default:
        throw new Error(`Unexpected command ${command.type}`);
    }
  };
  let responder = respond;
  const send = (command: Packet): Promise<void> => {
    sent.push(command);
    responder(command);
    return Promise.resolve();
  };
  const context = captureRun(
    {
      ble: {
        status: 'connected',
        device: 'Offline fixture',
        info: null,
        batteryPercent: null,
        error: '',
        clearError: noop,
        connect: unsupported,
        disconnect: noop,
        request: (command, types, timeout = 5000, options) => {
          requests.push({ command, timeout });
          return requestPacket(inbox, send, command, types, timeout, options);
        },
        send,
        waitFor: inbox.waitFor,
        collectFor: inbox.collectFor,
      },
      selected: new Set(selected),
      toolSettings: DEFAULT_TOOL_SETTINGS,
      berSettings: { speed: 1000, frameSize: 'both', payloadMode: 'random', total: 20000 },
      vlanSettings: { tagging: false, id: '' },
      ipv4Settings: { mode: 'dhcp', ip: '', netmask: '', gateway: '', dns: '' },
      ipv6Mode: 'both',
      pingTargets: ['', '', ''],
      setExpanded: (update) => {
        expanded = typeof update === 'function' ? update(expanded) : update;
      },
      setRunning: (value) => {
        assert.equal(typeof value, 'boolean');
        if (typeof value === 'boolean') running.push(value);
      },
      setActiveTest: (value) => {
        if (typeof value !== 'function') active.push(value);
      },
      setNotice: noop,
      setFailures: (update) => {
        const next = typeof update === 'function' ? update(failures) : update;
        for (const key of Object.keys(failures)) Reflect.deleteProperty(failures, key);
        Object.assign(failures, next);
      },
      setWiremap: noop,
      setTdr: noop,
      setTdrGraph: noop,
      setBer: noop,
      setPoe: noop,
      setLink: noop,
      setCdplldp: noop,
      setVlan: noop,
      setTraffic: noop,
      setIpv4: noop,
      setIpv6: noop,
      setPing: noop,
      setExtip: noop,
    },
    snapshot,
  );
  return {
    context,
    snapshot,
    requests,
    sent,
    inbox,
    failures,
    get expanded() {
      return expanded;
    },
    active,
    running,
    respond,
    setResponder: (handler) => {
      responder = handler;
    },
  };
}

/** Advance the real production timers without waiting minutes or touching hardware. */
export async function finishWithClock(action: () => Promise<void>): Promise<void> {
  mock.timers.enable({ apis: ['setTimeout'] });
  let finished = false;
  const result = action().finally(() => {
    finished = true;
  });
  try {
    for (let second = 0; second < 180 && !finished; second += 1) {
      await setImmediate();
      mock.timers.tick(1000);
    }
    assert.equal(finished, true, 'Measurement run did not settle within its expected deadlines');
    await result;
  } finally {
    mock.timers.reset();
  }
}
