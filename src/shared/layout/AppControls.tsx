import type { ReactElement } from 'react';
import { FaGithub } from 'react-icons/fa';
import type { PockethernetState } from '@/device/usePockethernet';
import { AppIcon } from './Layout';
import { Button, StatusIndicator } from '@/shared/ui/UiPrimitives';

type ConnectionStatus = PockethernetState['status'];

export function GitHubLink(): ReactElement {
  return (
    <a
      className="github-link"
      href="https://github.com/jLynx/Pockethernet-Web"
      target="_blank"
      rel="noreferrer"
      aria-label="View Pocketweb for Pockethernet on GitHub"
      title="View on GitHub"
    >
      <FaGithub aria-hidden="true" />
    </a>
  );
}

export function AppFooter(): ReactElement {
  const year = new Date().getFullYear();
  return (
    <footer className="app-footer">
      <span>
        &copy; {year}{' '}
        <a href="https://jlynx.net" target="_blank" rel="noreferrer">
          jLynx.net
        </a>
        . Independent community project.
      </span>{' '}
      <span>
        Pockethernet is a registered trademark of Pockethernet Ltd. Not affiliated with, endorsed
        by, or sponsored by Pockethernet Ltd.
      </span>
    </footer>
  );
}

export function ConnectionButton({
  status,
  onClick,
}: {
  status: ConnectionStatus;
  onClick: () => void;
}): ReactElement {
  const label =
    status === 'connecting' ? 'Connecting...' : status === 'connected' ? 'Connected' : 'Connect';
  return (
    <Button unstyled className={`connection-button ${status}`} onClick={onClick}>
      <span className="connection-symbol">
        <AppIcon name="device" />
      </span>
      <span className="connection-copy">
        <small>Device</small>
        <strong>{label}</strong>
      </span>
      <span className="connection-dot" />
    </Button>
  );
}

interface ActionDockProps {
  status: ConnectionStatus;
  selectedCount: number;
  running: boolean;
  canMeasure: boolean;
  onMeasure: () => void;
}

export function ActionDock({
  status,
  selectedCount,
  running,
  canMeasure,
  onMeasure,
}: ActionDockProps): ReactElement {
  const statusLabel =
    status === 'connected'
      ? `${selectedCount} test${selectedCount === 1 ? '' : 's'} selected`
      : 'Connect a device to measure';
  return (
    <div className="action-dock">
      <div className="action-status">
        <StatusIndicator status={status} />
        {statusLabel}
      </div>
      <Button
        unstyled
        className="measure-button"
        disabled={running || status !== 'connected' || !canMeasure}
        onClick={onMeasure}
      >
        {running ? (
          <>
            <span className="spinner" />
            Measuring...
          </>
        ) : (
          'Measure'
        )}
      </Button>
    </div>
  );
}

export function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}): ReactElement {
  return (
    <Button unstyled className="toast" onClick={onDismiss}>
      {message}
    </Button>
  );
}
