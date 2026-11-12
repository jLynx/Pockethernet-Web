import { useState, type ReactElement, type ReactNode } from 'react';
import { FiSettings } from 'react-icons/fi';
import type { AppIconName, PanelStatus, Tab, TestId } from '@/app/types';
import { Button, Card, SelectionSwitch } from '@/shared/ui/UiPrimitives';

export function AppIcon({ name }: { name: AppIconName }): ReactElement {
  if (name === 'test')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10" cy="10" r="6" />
        <path d="m14.5 14.5 5 5M6 10h2l1.2-2.5 2 5 1.2-2.5H14" />
      </svg>
    );
  if (name === 'report')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7" />
      </svg>
    );
  if (name === 'settings') return <FiSettings aria-hidden="true" />;
  if (name === 'configure')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="9" cy="18" r="2" />
      </svg>
    );
  if (name === 'tools')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m14.5 6.5 3-3a5 5 0 0 1-6 6L5 16l3 3 6.5-6.5a5 5 0 0 1 6-6l-3 3z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="10" width="8" height="11" rx="2" />
      <circle cx="12" cy="17" r="1" />
      <path d="M7 8a7 7 0 0 1 10 0M9.5 9.5a3.6 3.6 0 0 1 5 0" />
    </svg>
  );
}

export function MainNav({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
}): ReactElement {
  return (
    <nav className="main-nav">
      <NavTile
        icon="test"
        label="Test"
        active={tab === 'test'}
        onClick={() => {
          onChange('test');
        }}
      />
      <NavTile
        icon="configure"
        label="Configure"
        active={tab === 'configure'}
        onClick={() => onChange('configure')}
      />
      <NavTile
        icon="report"
        label="Reports"
        active={tab === 'report'}
        onClick={() => {
          onChange('report');
        }}
      />
      <NavTile
        icon="tools"
        label="Tools"
        active={tab === 'tools'}
        onClick={() => {
          onChange('tools');
        }}
      />
      <NavTile
        icon="settings"
        label="Settings"
        active={tab === 'settings'}
        onClick={() => onChange('settings')}
      />
    </nav>
  );
}

function NavTile({
  icon,
  label,
  active,
  onClick,
}: {
  icon: AppIconName;
  label: string;
  active: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <Button unstyled className={`nav-tile ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-icon">
        <AppIcon name={icon} />
      </span>
      <span>{label}</span>
    </Button>
  );
}

interface TestPanelProps {
  selectionDisabled?: boolean;
  selectable?: boolean;
  id: TestId;
  title: string;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  testing?: boolean;
  status?: PanelStatus;
  summary?: string;
  failure?: string;
  help: {
    description: string;
    note?: string;
  };
  children: ReactNode;
}

export function TestPanel({
  id,
  title,
  selected,
  expanded,
  onToggle,
  onExpand,
  testing = false,
  status = 'idle',
  summary,
  selectable = true,
  selectionDisabled = false,
  failure,
  help,
  children,
}: TestPanelProps): ReactElement {
  const [helpOpen, setHelpOpen] = useState(false);
  const fallback =
    id === 'wiremap' || id === 'tdr' || id === 'tdr-graph' ? 'Not measured' : 'Coming later';
  return (
    <Card className={`test-panel ${id} ${expanded ? 'expanded' : ''} ${testing ? 'testing' : ''}`}>
      <div className="test-panel-header">
        <Button
          unstyled
          className="test-label"
          onClick={selectable ? onToggle : onExpand}
          disabled={selectable && selectionDisabled}
          aria-pressed={selectable ? selected : undefined}
        >
          {selectable ? (
            <SelectionSwitch selected={selected} status={failure ? 'error' : status} />
          ) : (
            <span className={`test-status-dot ${failure ? 'error' : status}`} aria-hidden="true" />
          )}
          <span>{title}</span>
        </Button>
        <Button unstyled className="test-summary" onClick={onExpand}>
          {testing ? (
            <span className="testing-status" role="status" aria-live="polite">
              <i aria-hidden="true" />
              Testing
            </span>
          ) : (
            <span>{failure || summary || fallback}</span>
          )}
          <b aria-hidden="true" />
        </Button>
        {expanded && (
          <Button
            unstyled
            className="test-help-button"
            onClick={() => setHelpOpen((open) => !open)}
            aria-expanded={helpOpen}
            aria-controls={`${id}-help`}
            aria-label={`About the ${title} test`}
            title={`About the ${title} test`}
          >
            <span aria-hidden="true">i</span>
          </Button>
        )}
      </div>
      {expanded && (
        <div className="test-result">
          {helpOpen && (
            <aside className="test-help" id={`${id}-help`} aria-label={`${title} test help`}>
              <p>{help.description}</p>
              {help.note && <p className="test-help-note">{help.note}</p>}
            </aside>
          )}
          {children}
        </div>
      )}
    </Card>
  );
}

export function SimplePage({ title }: { title: string }): ReactElement {
  return (
    <main className="simple-page">
      <h1>{title}</h1>
      <p>This screen is being recreated from the original app.</p>
    </main>
  );
}
