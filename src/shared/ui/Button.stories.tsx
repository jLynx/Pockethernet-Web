import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, ButtonLink } from './UiPrimitives';

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Run measurement', onClick: () => undefined },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Disabled: Story = { args: { variant: 'primary', disabled: true } };
export const Link: Story = {
  args: { variant: 'secondary' },
  render: () => (
    <ButtonLink href="https://pockethernet.com/manual" external>
      Open manual
    </ButtonLink>
  ),
};

export const AllVariants: Story = {
  args: { variant: 'primary' },
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="primary" disabled>
        Disabled
      </Button>
    </div>
  ),
};
