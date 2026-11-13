import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TestId } from '@/app/types';
import { TestPage } from '@/features/measurements/TestPage';
import { ToolsPage } from '@/features/tools/ToolsPage';

const noop = (): void => undefined;

const meta = {
  title: 'App/Pages',
  component: TestPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TestPage>;

export default meta;
type Story = StoryObj<typeof meta>;

const testPageArgs = {
  selected: new Set(['wiremap', 'link'] as const),
  expanded: new Set<TestId>(),
  onToggle: noop,
  onExpandedChange: noop,
  running: false,
  activeTest: null,
  toolSettings: {
    tia: '568B' as const,
    units: 'meters' as const,
    nvp: '68',
    customMac: 'off' as const,
    mac: '',
  },
  wiremap: null,
  tdr: null,
  tdrGraph: null,
  ber: null,
  poe: null,
  link: null,
  cdplldp: null,
  vlan: null,
  traffic: null,
  ipv4: null,
  ipv6: null,
  extip: null,
  ping: null,
};

export const Tests: Story = { args: testPageArgs };
export const Measuring: Story = {
  args: { ...testPageArgs, running: true, activeTest: 'link' },
};
export const ExpandedTest: Story = {
  args: { ...testPageArgs, expanded: new Set(['wiremap'] as const) },
};

export const Tools: Story = {
  args: testPageArgs,
  render: () => (
    <ToolsPage
      firmwareLocked={false}
      blinkerSettings={{ speed: 'auto', duplex: 'auto', mdi: 'auto', link: 'off' }}
      onBlinkerSettingsChange={noop}
      onBlinkerChange={() => Promise.resolve(true)}
      tonerSettings={{ pair: 'all', shield: 'off', tone: '1', volume: 'low', power: 'off' }}
      onTonerSettingsChange={noop}
      onTonerChange={() => Promise.resolve(true)}
      wifiSettings={{ name: 'Pockethernet', password: '', enabled: 'off' }}
      onWifiSettingsChange={noop}
      onWifiChange={() => Promise.resolve(true)}
    />
  ),
};
