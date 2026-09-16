import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToolAction, ToolControl, ToolField, ToolInfoRow, ToolPanel } from './ToolControls';

const meta = {
  title: 'Tools/Controls',
  component: ToolPanel,
  tags: ['autodocs'],
  decorators: [
    (StoryComponent) => (
      <div style={{ width: 'min(560px, 90vw)' }}>
        <StoryComponent />
      </div>
    ),
  ],
} satisfies Meta<typeof ToolPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Panel: Story = {
  args: {
    title: 'Link blinker',
    active: true,
    summary: 'Blink at 1000 Mbit',
    children: (
      <ToolControl
        label="Speed"
        name="speed"
        value="1000"
        options={[
          ['10', '10'],
          ['100', '100'],
          ['1000', '1000'],
          ['auto', 'Auto'],
        ]}
        onChange={() => undefined}
      />
    ),
  },
};

export const ControlGallery: Story = {
  args: {
    title: 'Device preferences',
    active: false,
    summary: 'Cable and report defaults',
    children: null,
  },
  render: () => (
    <ToolPanel title="Device preferences" active={false} summary="Cable and report defaults">
      <ToolControl
        label="TIA"
        name="tia"
        value="568B"
        options={[
          ['568A', '568A'],
          ['568B', '568B'],
        ]}
        onChange={() => undefined}
      />
      <ToolField label="NVP value" value="68" onChange={() => undefined} inputMode="numeric" />
      <ToolField
        label="MAC"
        value=""
        placeholder="00:11:22:33:44:55"
        disabled
        onChange={() => undefined}
      />
      <ToolInfoRow label="FW version" value="2.4.1" />
      <ToolAction
        label="Firmware"
        action="Check for upgrade"
        disabled={false}
        onClick={() => undefined}
      />
      <ToolAction label="User manual" action="Open manual" href="https://pockethernet.com/manual" />
    </ToolPanel>
  ),
};
