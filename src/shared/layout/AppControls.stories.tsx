import type { Meta, StoryObj } from '@storybook/react-vite';
import logo from '@/assets/logo.png';
import { ActionDock, ConnectionButton, GitHubLink, Toast } from './AppControls';
import { MainNav } from './Layout';

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

export const Battery: Story = {
  args: { status: 'connected', batteryPercent: 76, onClick: () => undefined },
};

export const EmptyBattery: Story = {
  args: { status: 'connected', batteryPercent: 0, onClick: () => undefined },
};

export const Header: Story = {
  args: { status: 'connected', batteryPercent: 90, onClick: () => undefined },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="original-app">
      <header className="original-header">
        <img className="wordmark" src={logo} alt="Pocketweb for Pockethernet" />
        <div className="header-actions">
          <GitHubLink />
          <ConnectionButton {...args} />
        </div>
      </header>
      <MainNav tab="test" onChange={() => undefined} />
    </div>
  ),
};

export const HeaderWidths: Story = {
  args: Header.args,
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {[320, 390, 394, 430, 600].map((width) => (
        <figure key={width} style={{ margin: 0 }}>
          <figcaption>{width}px</figcaption>
          <iframe
            title={`Connected header at ${width}px`}
            src="./iframe.html?id=app-app-controls--header&viewMode=story"
            width={width}
            height={145}
            style={{ border: '1px solid #718096', boxSizing: 'content-box', display: 'block' }}
          />
        </figure>
      ))}
    </div>
  ),
};

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
