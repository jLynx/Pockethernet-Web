import type { ReactElement } from 'react';
import type { WorkflowMode } from '@/app/types';
import { SegmentedControl } from '@/shared/ui/UiPrimitives';

export function WorkflowSelector({
  mode,
  disabled,
  onChange,
}: {
  mode: WorkflowMode;
  disabled: boolean;
  onChange: (mode: WorkflowMode) => void;
}): ReactElement {
  return (
    <fieldset className="workflow-selector" disabled={disabled} aria-label="Testing workflow">
      <SegmentedControl
        value={mode}
        options={[
          ['single', 'Single test'],
          ['batch', 'Batch testing'],
        ]}
        onChange={onChange}
      />
    </fieldset>
  );
}
