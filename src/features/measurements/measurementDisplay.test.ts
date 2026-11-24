import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsePoePacket } from '@/pockethernetProtocol';
import type { TestId } from '@/app/types';
import { emptyResults } from '@/app/useMeasurementState';
import { DEFAULT_TOOL_SETTINGS } from '@/app/storage';
import { TestPanel } from '@/shared/layout/Layout';
import { TestPage } from './TestPage';
import { PoeResults } from './results/CableResults';
import { Ipv4Results, Ipv6Results } from './results/NetworkResults';

const failed = renderToStaticMarkup(
  createElement(TestPanel, {
    id: 'poe',
    title: 'PoE',
    selected: true,
    expanded: false,
    onToggle: () => {},
    onExpand: () => {},
    status: 'idle',
    summary: 'Not measured',
    failure: 'The device did not respond in time',
    help: { description: 'PoE' },
    children: null,
  }),
);
assert.match(failed, /selection-switch switch error/);
assert.match(failed, /The device did not respond in time/);
assert.doesNotMatch(failed, /Not measured/);

const noPower = renderToStaticMarkup(
  createElement(PoeResults, {
    result: parsePoePacket(new Uint8Array(32)),
    tia: '568B',
  }),
);
assert.match(noPower, /No power detected/);
assert.match(noPower, /No PoE supply was detected/);
assert.doesNotMatch(noPower, /Passive|0 V|undefined/);
const partialIpv6 = renderToStaticMarkup(
  createElement(Ipv6Results, {
    result: {
      status: 'not_OK',
      summary: 'SLAAC Router Advertisement received / No DHCPv6 response received',
      results: [
        {
          protocol: 'SLAAC',
          status: 'OK',
          summary: 'SLAAC Router Advertisement received',
          fields: { 'Prefix addr': '2001:DB8::', MTU: '1500' },
        },
      ],
    },
  }),
);
assert.match(partialIpv6, /No DHCPv6 response received/);
assert.match(partialIpv6, /2001:DB8::/);
assert.match(partialIpv6, /1500/);

const legacyDiscovery = renderToStaticMarkup(
  createElement(TestPage, {
    ...emptyResults(),
    batch: false,
    selected: new Set<TestId>(['network-discovery', 'ber']),
    expanded: new Set<TestId>(),
    onToggle: () => {},
    onExpandedChange: () => {},
    running: false,
    activeTest: null,
    toolSettings: DEFAULT_TOOL_SETTINGS,
    unavailableTests: {
      'network-discovery': 'Requires firmware V18+',
      ber: 'Requires firmware V15+',
    },
  }),
);
const discoveryPanel = legacyDiscovery.match(
  /<section class="ui-card test-panel network-discovery[^>]*>.*?<\/section>/s,
)?.[0];
assert.ok(discoveryPanel);
assert.match(discoveryPanel, /class="test-label" disabled="" aria-pressed="false"/);
assert.match(discoveryPanel, /Requires firmware V18\+/);
const berPanel = legacyDiscovery.match(
  /<section class="ui-card test-panel ber[^>]*>.*?<\/section>/s,
)?.[0];
assert.ok(berPanel);
assert.match(berPanel, /class="test-label" disabled="" aria-pressed="false"/);
assert.match(berPanel, /Requires firmware V15\+/);

const extendedDhcp = renderToStaticMarkup(
  createElement(Ipv4Results, {
    result: {
      status: 'OK',
      summary: 'IP assigned',
      fields: {
        'Vendor class': 'Test class',
        'Captive portal URL': 'https://portal.example/',
        'Classless routes': '192.0.2.0/24 via 198.51.100.1',
      },
    },
  }),
);
assert.match(extendedDhcp, /Test class/);
assert.match(extendedDhcp, /https:\/\/portal\.example\//);
assert.match(extendedDhcp, /192\.0\.2\.0\/24 via 198\.51\.100\.1/);
console.log(
  'Measurement failure, No PoE, partial IPv6 and firmware availability display tests passed.',
);
