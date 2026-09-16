import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, DataRow, SectionTitle } from './UiPrimitives';

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  decorators: [
    (StoryComponent) => (
      <div style={{ width: 'min(520px, 90vw)' }}>
        <StoryComponent />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div style={{ padding: 20 }}>
        <SectionTitle className="link-section-title">Connection</SectionTitle>
        <DataRow className="link-row" label="Speed" value="1000 Mbit" />
        <DataRow className="link-row" label="Duplex" value="Full" />
      </div>
    ),
  },
};

export const Compact: Story = {
  args: {
    children: (
      <div style={{ padding: 16 }}>
        <strong>Compact card</strong>
        <p style={{ marginBottom: 0, color: '#68768a' }}>A neutral surface for grouped content.</p>
      </div>
    ),
  },
};
