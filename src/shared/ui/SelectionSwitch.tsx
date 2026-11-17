import type { ReactElement } from 'react';

export interface SelectionSwitchProps {
  selected: boolean;
  status?: 'idle' | 'ok' | 'error';
}

export function SelectionSwitch({ selected, status = 'idle' }: SelectionSwitchProps): ReactElement {
  return (
    <span className={`selection-switch switch ${selected ? status : 'off'}`} aria-hidden="true">
      <i />
    </span>
  );
}
