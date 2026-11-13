import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ComponentProps, type ReactElement } from 'react';
import { Button, ButtonLink, Card } from '@/shared/ui/UiPrimitives';
import { PageLayout } from './PageLayout';
import { WorkflowSelector } from './WorkflowSelector';

function PreviewContent(): ReactElement {
  return (
    <Card>
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Page content</h2>
        <p
          style={{
            margin: 0,
            color: 'var(--text-muted, #5f6e80)',
            fontSize: '0.86rem',
            lineHeight: 1.5,
          }}
        >
          The header and page margins come from the shared layout.
        </p>
      </div>
    </Card>
  );
}

function WorkflowPreview(props: ComponentProps<typeof PageLayout>): ReactElement {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  return (
    <PageLayout
      {...props}
      headerChildren={<WorkflowSelector mode={mode} disabled={false} onChange={setMode} />}
    />
  );
}

const meta = {
  title: 'App/Page layout',
  component: PageLayout,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '900px' }, type: 'desktop' },
        mobile: { name: 'Mobile', styles: { width: '390px', height: '844px' }, type: 'mobile' },
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="original-app">
        <Story />
      </div>
    ),
  ],
  args: {
    eyebrow: 'Measurement history',
    title: 'Reports',
    description: 'View, export, and share your saved measurement reports.',
    children: <PreviewContent />,
  },
  argTypes: {
    children: { control: false },
    headerChildren: { control: false },
    action: { control: false },
  },
} satisfies Meta<typeof PageLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reports: Story = {};
export const Settings: Story = {
  args: {
    eyebrow: 'App & device',
    title: 'Settings',
    description: 'Appearance, notifications, and device information.',
  },
};
export const WithAction: Story = {
  args: {
    eyebrow: 'Device tools',
    title: 'Tools',
    description: 'Trace a cable, identify a port, or enable the WiFi bridge.',
    action: (
      <ButtonLink href="https://pockethernet.com/manual" external>
        Manual
      </ButtonLink>
    ),
  },
};
export const WithWorkflow: Story = {
  args: {
    eyebrow: 'Test & report setup',
    title: 'Configure',
    description:
      'Set cable and report defaults here. Choose tests and adjust their controls on Test.',
  },
  render: (args) => <WorkflowPreview {...args} />,
};
export const GridContent: Story = {
  args: {
    eyebrow: 'Cable diagnostics',
    title: 'Choose your tests',
    description: 'Select one or more tests, adjust their controls, then measure.',
    contentLayout: 'grid',
    children: (
      <>
        <PreviewContent />
        <PreviewContent />
      </>
    ),
  },
  render: (args) => <WorkflowPreview {...args} />,
};
export const LongText: Story = {
  args: {
    title: 'Configure cable and report defaults',
    description:
      'Configure your batch tests and report defaults once, then work through your cables from Test. Review each measurement before saving and moving to the next cable.',
    action: <Button>Choose tests</Button>,
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
export const MobileWithAction: Story = {
  ...WithAction,
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
export const MobileWithWorkflow: Story = {
  ...GridContent,
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
