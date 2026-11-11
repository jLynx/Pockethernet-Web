import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsePoePacket } from '@/pockethernetProtocol';
import { TestPanel } from '@/shared/layout/Layout';
import { PoeResults } from './results/CableResults';

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
assert.match(noPower, /No PoE/);
assert.doesNotMatch(noPower, /Passive|0 V|undefined/);
console.log('Measurement failure/No PoE display tests passed.');
