import assert from 'node:assert/strict';
import { PACKET } from '@/protocol/constants';
import { isTesterUse, probablyIdleShutdown } from './testerActivity';

const lastUse = 100_000;
const almostIdle = lastUse + 59 * 60_000 - 1;
assert.equal(probablyIdleShutdown(32, lastUse, almostIdle), false);
assert.equal(probablyIdleShutdown(32, lastUse, almostIdle + 1), true);
assert.equal(probablyIdleShutdown(33, lastUse, almostIdle + 1), true);
assert.equal(probablyIdleShutdown(31, lastUse, almostIdle + 1), false);
assert.equal(probablyIdleShutdown(undefined, lastUse, almostIdle + 1), false);
assert.equal(probablyIdleShutdown(32, null, almostIdle + 1), false);

assert.equal(isTesterUse(PACKET.BATTERY_STATUS), false);
assert.equal(isTesterUse(PACKET.DEVICE_INFO), false);
assert.equal(isTesterUse(PACKET.TONER_MELODY), true);
assert.equal(isTesterUse(PACKET.DISCOVERY_START), true);
