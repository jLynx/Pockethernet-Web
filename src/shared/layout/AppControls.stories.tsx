import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActionDock, ConnectionButton, Toast } from './AppControls';

const meta = {
  title: 'App/App controls',
  component: ConnectionButton,
  tags: ['autodocs'],
} satisfies Meta<typeof ConnectionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disconnected: Story = { args: { status: 'disconnected', onClick: () => undefined } };
export const Connecting: Story = { args: { status: 'connecting', onClick: () => undefined } };
export const Connected: Story = { args: { status: 'connected', onClick: () => undefined } };

export const MeasurementDock: Story = {
  args: { status: 'connected', onClick: () => undefined },
  parameters: { layout: 'fullscreen' },
  render: () => (
    <ActionDock
      status="connected"
      selectedCount={3}
      running={false}
      canMeasure
      onMeasure={() => undefined}
    />
  ),
};

export const Measuring: Story = {
  args: { status: 'connected', onClick: () => undefined },
  parameters: { layout: 'fullscreen' },
  render: () => (
    <ActionDock
      status="connected"
      selectedCount={3}
      running
      canMeasure
      onMeasure={() => undefined}
    />
  ),
};

export const Notice: Story = {
  args: { status: 'connected', onClick: () => undefined },
  render: () => <Toast message="Connect Pockethernet first." onDismiss={() => undefined} />,
};
