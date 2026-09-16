import type { Meta, StoryObj } from '@storybook/react-vite';
import { BerResults } from './BerResults';
import { LinkResults, PoeResults } from './CableResults';
import {
  CdpLldpResults,
  ExternalIpResults,
  Ipv4Results,
  Ipv6Results,
  PingResults,
  TrafficResults,
  VlanResults,
} from './NetworkResults';
import { TdrGraphs, TdrResults } from './TdrResults';
import { WiremapDiagram } from './WiremapDiagram';

const noop = (): void => undefined;
const settings = {
  speed: 1000 as const,
  frameSize: 'both' as const,
  payloadMode: 'random' as const,
  total: 100000,
};

const meta = {
  title: 'Results/Measurement results',
  component: BerResults,
  tags: ['autodocs'],
  decorators: [
    (StoryComponent) => (
      <div style={{ width: 'min(800px, calc(100vw - 32px))' }}>
        <StoryComponent />
      </div>
    ),
  ],
} satisfies Meta<typeof BerResults>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BitErrorRate: Story = {
  args: {
    settings,
    disabled: false,
    onSettingsChange: noop,
    result: {
      sent: 100000,
      received: 99998,
      errors: 2,
      ratio: 0.00002,
      errorRate: '0.002%',
      summary: '2 errors',
      completedBatches: 10,
      batchCount: 10,
    },
  },
};

export const CableResults: Story = {
  args: { settings, disabled: false, onSettingsChange: noop, result: null },
  render: () => (
    <div style={{ display: 'grid', gap: 18 }}>
      <PoeResults
        tia="568B"
        result={{
          status: 'OK',
          summary: 'PoE+',
          poeType: '802.3at',
          openVoltage: 51.2,
          loadVoltage: 48.4,
          polarity: 'Mode A',
          adc: [],
          pairVoltages: [48.4, 48.1, 0, 0],
          maxClass: 'Class 4',
        }}
      />
      <LinkResults
        tia="568B"
        result={{
          status: 'OK',
          summary: '1000 Mbit',
          linkUp: true,
          speed: 1000,
          duplex: 'Full duplex',
          partnerCapabilities: {
            '10M': 'Full / Half',
            '100M': 'Full / Half',
            '1000M': 'Full',
            multig: 'No',
          },
          polarity: ['Normal', 'Normal', 'Normal', 'Normal'],
          skewDelay: [0, 2, 1, 3],
          lengthEstimate: 18,
        }}
      />
    </div>
  ),
};

export const NetworkResults: Story = {
  args: { settings, disabled: false, onSettingsChange: noop, result: null },
  render: () => (
    <div style={{ display: 'grid', gap: 18 }}>
      <CdpLldpResults
        result={{
          status: 'OK',
          summary: 'Switch discovered',
          protocol: 'LLDP',
          source: '00:11:22:33:44:55',
          fields: { 'System name': 'core-switch-01', Port: 'Gi1/0/24' },
        }}
      />
      <ExternalIpResults
        result={{
          status: 'OK',
          summary: 'Address found',
          fields: { IPv4: '203.0.113.42', Provider: 'Example ISP' },
        }}
      />
      <TrafficResults
        result={{
          status: 'OK',
          summary: '2 packets',
          packets: [
            { source: '00:11:22:33:44:55', destination: 'ff:ff:ff:ff:ff:ff', vlanId: '100' },
          ],
        }}
      />
    </div>
  ),
};

export const ConfigurableResults: Story = {
  args: { settings, disabled: false, onSettingsChange: noop, result: null },
  render: () => (
    <div style={{ display: 'grid', gap: 18 }}>
      <VlanResults
        result={{
          status: 'OK',
          summary: 'VLAN detected',
          tags: [{ id: 100, priority: 5, dei: false }],
        }}
        settings={{ tagging: true, id: '100' }}
        onSettingsChange={noop}
        disabled={false}
      />
      <Ipv4Results
        result={{
          status: 'OK',
          summary: 'DHCP complete',
          fields: { 'Your IP': '192.168.1.42', Gateway: '192.168.1.1', DNS: '1.1.1.1' },
        }}
        settings={{ mode: 'dhcp', ip: '', netmask: '', gateway: '', dns: '' }}
        onSettingsChange={noop}
        disabled={false}
      />
      <Ipv6Results
        result={{
          status: 'OK',
          summary: 'SLAAC complete',
          results: [
            {
              status: 'OK',
              summary: 'Address found',
              protocol: 'SLAAC',
              fields: { Address: '2001:db8::42', Prefix: '/64' },
            },
          ],
        }}
        mode="slaac"
        onModeChange={noop}
        disabled={false}
      />
      <PingResults
        result={{
          status: 'OK',
          summary: 'Reachable',
          servers: [{ status: 'OK', ip: '1.1.1.1', time: '12 ms' }],
        }}
        targets={['one.one.one.one', '', '']}
        onTargetsChange={noop}
        disabled={false}
      />
    </div>
  ),
};

export const CableDiagrams: Story = {
  args: { settings, disabled: false, onSettingsChange: noop, result: null },
  render: () => (
    <div style={{ display: 'grid', gap: 18 }}>
      <WiremapDiagram
        tia="568B"
        result={{
          status: 'OK',
          summary: 'Straight through',
          connections: [0, 1, 2, 3, 4, 5, 6, 7, 8],
          shorts: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          id: 1,
          adapterType: 0,
        }}
      />
      <TdrResults
        units="meters"
        tia="568B"
        result={{
          status: 'OK',
          summary: '18.2 m',
          nvp: 68,
          pairs: [2, 3, 1, 4].map(() => ({ status: 'Terminated', distance: 18.2, samples: [] })),
        }}
      />
    </div>
  ),
};

export const GraphsAwaitingMeasurement: Story = {
  args: { settings, disabled: false, onSettingsChange: noop, result: null },
  render: () => <TdrGraphs result={null} units="meters" tia="568B" />,
};
