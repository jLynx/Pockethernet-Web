import { useId, useRef, useState, type ReactElement } from 'react';
import { ToolPanel } from '@/features/tools/ToolControls';
import { Button } from '@/shared/ui/UiPrimitives';

export function ResetSettingsPanel({
  disabled,
  onReset,
}: {
  disabled: boolean;
  onReset: () => Promise<void>;
}): ReactElement {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [resetting, setResetting] = useState(false);
  const confirmReset = async (): Promise<void> => {
    if (disabled || resetting) return;
    setResetting(true);
    try {
      await onReset();
    } finally {
      dialog.current?.close();
      setResetting(false);
    }
  };
  return (
    <>
      <ToolPanel title="Reset Pocketweb">
        <p className="settings-hint">
          Restore Pocketweb defaults and delete every report saved in this browser.
        </p>
        <Button disabled={disabled || resetting} onClick={() => dialog.current?.showModal()}>
          Reset settings &amp; delete reports
        </Button>
      </ToolPanel>
      <dialog
        ref={dialog}
        className="reset-dialog"
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          if (resetting) event.preventDefault();
        }}
      >
        <h2 id={titleId}>Reset Pocketweb?</h2>
        <p id={descriptionId}>
          This permanently deletes all reports saved in this browser and restores Pocketweb settings
          to their defaults.
        </p>
        <div className="reset-dialog-actions">
          <Button disabled={resetting} onClick={() => dialog.current?.close()}>
            Cancel
          </Button>
          <Button
            className="reset-confirm"
            disabled={disabled || resetting}
            onClick={() => void confirmReset()}
          >
            {resetting ? 'Resetting…' : 'Reset & delete reports'}
          </Button>
        </div>
      </dialog>
    </>
  );
}
