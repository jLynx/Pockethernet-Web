import assert from 'node:assert/strict';
import { igmpQuerierStatus } from './discoveryDisplay';
import type { NetworkDiscoveryResult } from './types';

const discovery: NetworkDiscoveryResult = {
  state: 'completed',
  status: 'OK',
  summary: '',
  mode: 'active',
  hosts: [],
  observations: [],
};

assert.equal(igmpQuerierStatus(discovery), 'Inconclusive');
assert.equal(igmpQuerierStatus({ ...discovery, listenMs: 129_999 }), 'Inconclusive');
assert.equal(igmpQuerierStatus({ ...discovery, listenMs: 130_000 }), 'None observed');
assert.equal(igmpQuerierStatus({ ...discovery, state: 'listening' }), undefined);
assert.equal(
  igmpQuerierStatus({
    ...discovery,
    state: 'listening',
    observations: [{ type: 7, key: '7:192.0.2.1', label: 'IGMP querier', fields: {} }],
  }),
  'Detected',
);
