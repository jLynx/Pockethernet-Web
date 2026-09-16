import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl, SelectField, TextField } from './UiPrimitives';

const meta = {
  title: 'UI/Form controls',
  component: TextField,
  tags: ['autodocs'],
  args: { label: 'MAC address', value: '00:11:22:33:44:55', onChange: () => undefined },
  decorators: [
    (StoryComponent) => (
      <div style={{ width: 'min(440px, 90vw)' }}>
        <StoryComponent />
      </div>
    ),
  ],
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextInput: Story = {};
export const Placeholder: Story = { args: { value: '', placeholder: 'Enter IP address' } };
export const Disabled: Story = { args: { disabled: true } };

export const Select: Story = {
  render: () => (
    <SelectField label="Link speed" value="1000" onChange={() => undefined}>
      <option value="100">100 Mbps</option>
      <option value="1000">1000 Mbps</option>
    </SelectField>
  ),
};

export const Segmented: Story = {
  render: () => (
    <SegmentedControl
      value="auto"
      options={[
        ['10', '10'],
        ['100', '100'],
        ['1000', '1000'],
        ['auto', 'Auto'],
      ]}
      onChange={() => undefined}
    />
  ),
};

export const FormGroup: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 16 }}>
      <TextField label="WiFi name" value="Pockethernet" onChange={() => undefined} />
      <SelectField label="Units" value="meters" onChange={() => undefined}>
        <option value="meters">Meters</option>
        <option value="feet">Feet</option>
      </SelectField>
      <SegmentedControl
        value="568B"
        options={[
          ['568A', '568A'],
          ['568B', '568B'],
        ]}
        onChange={() => undefined}
      />
    </div>
  ),
};
