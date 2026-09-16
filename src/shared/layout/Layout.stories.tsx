import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppIcon, MainNav, SimplePage, TestPanel } from './Layout';

const meta = {
  title: 'App/Test panel',
  component: TestPanel,
  tags: ['autodocs'],
  decorators: [
    (StoryComponent) => (
      <div style={{ width: 'min(760px, 90vw)' }}>
        <StoryComponent />
      </div>
    ),
  ],
} satisfies Meta<typeof TestPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  id: 'wiremap' as const,
  title: 'Wiremap',
  selected: false,
  expanded: false,
  onToggle: (): void => undefined,
  onExpand: (): void => undefined,
  help: {
    description: 'Connect the Pockethernet Wiremap Adapter to the far end of the cable run.',
    note: 'Do not test against an Ethernet port.',
  },
  children: <div className="placeholder-detail">Measurement details</div>,
};

export const Idle: Story = { args: { ...baseArgs, summary: 'Not measured' } };
export const Selected: Story = {
  args: { ...baseArgs, selected: true, status: 'idle', summary: 'Ready' },
};
export const Testing: Story = {
  args: { ...baseArgs, selected: true, testing: true, summary: 'Not measured' },
};
export const Expanded: Story = {
  args: { ...baseArgs, selected: true, expanded: true, status: 'ok', summary: 'All pairs OK' },
};
export const Error: Story = {
  args: { ...baseArgs, selected: true, status: 'error', summary: 'Short on pair 2' },
};

export const Navigation: Story = {
  args: baseArgs,
  parameters: { layout: 'fullscreen' },
  render: () => <MainNav tab="test" onChange={() => undefined} />,
};

export const Icons: Story = {
  args: baseArgs,
  render: () => (
    <div style={{ display: 'flex', gap: 24 }}>
      {(['test', 'report', 'tools', 'device'] as const).map((name) => (
        <span className="nav-icon" key={name}>
          <AppIcon name={name} />
        </span>
      ))}
    </div>
  ),
};

export const PlaceholderPage: Story = {
  args: baseArgs,
  render: () => <SimplePage title="Reports" />,
};
