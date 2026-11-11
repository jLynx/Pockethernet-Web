import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ComponentProps, type ReactElement } from 'react';
import logo from '@/assets/logo.png';
import type { TestId } from '@/app/types';
import { PageHeader } from '@/shared/ui/UiPrimitives';
import { ActionDock, ConnectionButton, GitHubLink } from './AppControls';
import { AppUpdateBanner } from './AppUpdate';
import { MainNav, TestPanel } from './Layout';

const previewTests: { id: TestId; title: string }[] = [
  { id: 'wiremap', title: 'Wiremap' },
  { id: 'tdr', title: 'TDR' },
  { id: 'tdr-graph', title: 'TDR Graph' },
  { id: 'ber', title: 'Error rate' },
  { id: 'poe', title: 'PoE' },
  { id: 'link', title: 'Link' },
];

function DismissibleUpdate(props: ComponentProps<typeof AppUpdateBanner>): ReactElement | null {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <AppUpdateBanner
      {...props}
      onDismiss={() => {
        props.onDismiss();
        setDismissed(true);
      }}
    />
  );
}

const meta = {
  title: 'App/App update',
  component: AppUpdateBanner,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { onUpdate: () => undefined, onDismiss: () => undefined },
  render: (args) => <DismissibleUpdate {...args} />,
  decorators: [
    (Story) => (
      <div className="original-app">
        <header className="original-header">
          <img className="wordmark" src={logo} alt="Pocketweb for Pockethernet" />
          <div className="header-actions">
            <GitHubLink />
            <ConnectionButton status="connected" batteryPercent={90} onClick={() => undefined} />
          </div>
        </header>
        <MainNav tab="test" onChange={() => undefined} />
        <main className="test-page">
          <PageHeader
            className="test-intro"
            eyebrow="Cable diagnostics"
            title="Choose your tests"
            description="Select one or more tests, connect your Pockethernet, then measure."
          />
          {previewTests.map(({ id, title }) => (
            <TestPanel
              key={id}
              id={id}
              title={title}
              selected={id === 'wiremap'}
              expanded={false}
              summary="Not measured"
              onToggle={() => undefined}
              onExpand={() => undefined}
              help={{ description: '' }}
            >
              {null}
            </TestPanel>
          ))}
        </main>
        <ActionDock
          status="connected"
          selectedCount={1}
          running={false}
          canMeasure
          onMeasure={() => undefined}
        />
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppUpdateBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {};
export const DeviceBusy: Story = { args: { busy: true } };
export const Updating: Story = { args: { updating: true } };
export const Failed: Story = { args: { error: true } };
