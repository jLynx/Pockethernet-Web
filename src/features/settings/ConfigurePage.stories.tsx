import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useAppSettings } from '@/app/useAppSettings';
import { toggleSelection } from '@/app/testSelection';
import type { WorkflowMode } from '@/app/types';
import { ConfigurePage } from './ConfigurePage';
import { WorkflowSelector } from '@/shared/layout/WorkflowSelector';

function ConfigurePreview({
  mode,
  disabled,
}: {
  mode: WorkflowMode;
  disabled: boolean;
}): ReactElement {
  const app = useAppSettings();
  const [selectedMode, setSelectedMode] = useState(mode);
  const configuration =
    selectedMode === 'single' ? app.singleConfiguration : app.batchConfiguration;
  const [notice, setNotice] = useState('');
  return (
    <>
      <ConfigurePage
        app={{ ...app, ...configuration, workflowMode: selectedMode }}
        disabled={disabled}
        onToggle={(id) => configuration.setSelected((current) => toggleSelection(current, id))}
        onNotice={setNotice}
        workflowSelector={
          <WorkflowSelector mode={selectedMode} disabled={disabled} onChange={setSelectedMode} />
        }
      />
      {notice && <p role="status">{notice}</p>}
    </>
  );
}

const meta = {
  title: 'Settings/Configure',
  component: ConfigurePreview,
  args: { mode: 'single', disabled: false },
  parameters: { layout: 'fullscreen' },
  render: (args) => <ConfigurePreview key={args.mode} {...args} />,
} satisfies Meta<typeof ConfigurePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleTest: Story = {};
export const BatchTesting: Story = { args: { mode: 'batch' } };
export const Disabled: Story = { args: { mode: 'batch', disabled: true } };
