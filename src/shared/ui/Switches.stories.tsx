import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectionSwitch, StatusIndicator, ToggleSwitch } from './UiPrimitives';

const meta = {
  title: 'UI/Toggle switch',
  component: ToggleSwitch,
  tags: ['autodocs'],
  args: { checked: false, onChange: () => undefined, ariaLabel: 'Feature enabled' },
} satisfies Meta<typeof ToggleSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const On: Story = { args: { checked: true } };
export const Disabled: Story = { args: { disabled: true } };

export const SelectionStates: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <SelectionSwitch selected={false} />
      <SelectionSwitch selected status="ok" />
      <SelectionSwitch selected status="error" />
    </div>
  ),
};

export const ConnectionStates: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <StatusIndicator status="disconnected" />
      <StatusIndicator status="connecting" />
      <StatusIndicator status="connected" />
    </div>
  ),
};
