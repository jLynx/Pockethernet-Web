import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataRow, EmptyState, PageHeader, SectionTitle, ToggleSwitch } from './UiPrimitives';

const meta = {
  title: 'UI/Primitives',
  component: DataRow,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof DataRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const KeyValueRow: Story = {
  args: { label: 'Link speed', value: '1000 Mbit', className: 'link-row' },
  render: (args) => (
    <div className="link-results" style={{ width: 420 }}>
      <DataRow {...args} />
    </div>
  ),
};

export const Gallery: Story = {
  args: { label: 'Link speed', value: '1000 Mbit', className: 'link-row' },
  render: () => (
    <div style={{ display: 'grid', gap: 24, width: 520 }}>
      <PageHeader
        eyebrow="Cable diagnostics"
        title="Choose your tests"
        description="Select one or more tests, then measure."
      />
      <section className="link-results">
        <SectionTitle className="link-section-title">Link partner capabilities</SectionTitle>
        <DataRow className="link-row" label="1000 Mbit" value="Full duplex" />
      </section>
      <div className="vlan-settings">
        <span>Outgoing VLAN tagging</span>
        <ToggleSwitch checked onChange={() => undefined} />
      </div>
      <EmptyState className="link-awaiting">Run a measurement to see link details</EmptyState>
      <EmptyState className="link-no-link" tone="error">
        No link
      </EmptyState>
    </div>
  ),
};
