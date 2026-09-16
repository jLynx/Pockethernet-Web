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
  berSettings: {
    speed: 1000 as const,
    frameSize: 'both' as const,
    payloadMode: 'random' as const,
    total: 100000,
  },
  onBerSettingsChange: noop,
  vlanSettings: { tagging: false, id: '' },
  onVlanSettingsChange: noop,
  ipv4Settings: { mode: 'dhcp' as const, ip: '', netmask: '', gateway: '', dns: '' },
  onIpv4SettingsChange: noop,
  ipv6Mode: 'slaac' as const,
  onIpv6ModeChange: noop,
  pingTargets: ['', '', ''],
  onPingTargetsChange: noop,
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
      deviceInfo={{
        serial: 120034,
        hardwareVersion: 2,
        stmVersion: 7,
        espVersion: 12,
        mac: '00:11:22:33:44:55',
      }}
      firmwareCheck={null}
      firmwareChecking={false}
      onCheckFirmware={() => Promise.resolve()}
      settings={{ tia: '568B', units: 'meters', nvp: '68', customMac: 'off', mac: '' }}
      onSettingsChange={noop}
      blinkerSettings={{ speed: 'auto', duplex: 'auto', mdi: 'auto', link: 'off' }}
      onBlinkerSettingsChange={noop}
      onBlinkerChange={() => Promise.resolve(true)}
      tonerSettings={{ pair: 'all', shield: 'off', tone: '1', volume: 'low', power: 'off' }}
      onTonerSettingsChange={noop}
      onTonerChange={() => Promise.resolve(true)}
      wifiSettings={{ name: 'Pockethernet', password: '', enabled: 'off' }}
      onWifiSettingsChange={noop}
      onWifiChange={() => Promise.resolve(true)}
      reportPreferences={{ logoDataUrl: '', logoName: '' }}
      onReportPreferencesChange={noop}
      onNotice={noop}
    />
  ),
};
