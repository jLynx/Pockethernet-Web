import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectionSwitch, type SelectionSwitchProps } from './SelectionSwitch';
import { Button } from './UiPrimitives';

const meta = {
  title: 'UI/Selection switch',
  component: SelectionSwitch,
  tags: ['autodocs'],
  args: { selected: false, status: 'idle' },
  argTypes: {
    selected: { control: 'boolean' },
    status: { control: 'select', options: ['idle', 'ok', 'error'] },
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Visual selection and result indicator. The parent control handles clicks, keyboard input, and accessible selection state.',
      },
    },
  },
} satisfies Meta<typeof SelectionSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Passed: Story = { args: { selected: true, status: 'ok' } };
export const Failed: Story = { args: { selected: true, status: 'error' } };

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24 }}>
      {(
        [
          ['Off', false, 'idle'],
          ['Selected', true, 'idle'],
          ['Passed', true, 'ok'],
          ['Failed', true, 'error'],
        ] as const
      ).map(([label, selected, status]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SelectionSwitch selected={selected} status={status} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  ),
};

function InteractiveExample(args: SelectionSwitchProps): ReactElement {
  const [selected, setSelected] = useState(false);
  return (
    <Button
      unstyled
      className="test-label"
      aria-pressed={selected}
      onClick={() => setSelected((current) => !current)}
    >
      <SelectionSwitch selected={selected} status={args.status} />
      <span>Select test</span>
    </Button>
  );
}

export const Interactive: Story = { render: (args) => <InteractiveExample {...args} /> };
