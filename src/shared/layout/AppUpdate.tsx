import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import { monitorAppUpdates, type AppUpdateWorker } from '@/app/appUpdates';
import { Button } from '@/shared/ui/UiPrimitives';

export function AppUpdateBanner({
  busy = false,
  updating = false,
  error = false,
  onUpdate,
  onDismiss,
}: {
  busy?: boolean;
  updating?: boolean;
  error?: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="app-update"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={(event) => {
        if (updating && event.key === 'Escape') event.preventDefault();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!updating) onDismiss();
      }}
    >
      <div className="app-update-heading">
        <span className="app-update-icon" aria-hidden="true">
          <FiDownload />
        </span>
        <div className="app-update-copy" role="status">
          <strong id={titleId}>{updating ? 'Updating Pocketweb' : 'Update available'}</strong>
          <span id={descriptionId}>
            {error
              ? 'The update could not start. Reload the page to try again.'
              : updating
                ? 'Pocketweb will reload when the update is installed.'
                : busy
                  ? 'Finish the current device operation to update Pocketweb.'
                  : 'A new version of Pocketweb is ready.'}
          </span>
        </div>
        <Button
          unstyled
          className="app-update-dismiss"
          aria-label="Update later"
          title="Update later"
          disabled={updating}
          onClick={onDismiss}
        >
          <FiX aria-hidden="true" />
        </Button>
      </div>
      <div className="app-update-actions">
        <Button variant="secondary" disabled={updating} onClick={onDismiss}>
          Later
        </Button>
        <Button variant="primary" disabled={busy || updating} onClick={onUpdate}>
          {updating ? 'Updating…' : 'Update now'}
        </Button>
      </div>
    </dialog>
  );
}

export function AppUpdate({ busy }: { busy: boolean }): ReactElement | null {
  const [waiting, setWaiting] = useState<AppUpdateWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(false);
  const monitor = useRef<ReturnType<typeof monitorAppUpdates> | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    const subscription = monitorAppUpdates({
      environment: {
        serviceWorkers: navigator.serviceWorker,
        page: document,
        host: window,
        isOnline: () => navigator.onLine,
        reload: () => window.location.reload(),
      },
      scriptUrl: `${import.meta.env.BASE_URL}sw.js`,
      onWaiting: (worker) => {
        setWaiting(worker);
        setDismissed(false);
        setError(false);
      },
      onError: (cause) => console.error('App update failed:', cause),
    });
    monitor.current = subscription;
    return () => {
      subscription.dispose();
      monitor.current = null;
    };
  }, []);

  if (!waiting || dismissed) return null;
  return (
    <AppUpdateBanner
      busy={busy}
      updating={updating}
      error={error}
      onUpdate={() => {
        if (busy || updating) return;
        if (monitor.current?.applyUpdate(waiting)) setUpdating(true);
        else setError(true);
      }}
      onDismiss={() => setDismissed(true)}
    />
  );
}
