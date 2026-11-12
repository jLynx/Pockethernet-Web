import type { ReactElement } from 'react';
import type { PingDefaults } from '@/app/types';
import { ToolControl, ToolField, ToolPanel } from './ToolControls';

export function PingDefaultsPanel({
  defaults,
  onChange,
}: {
  defaults: PingDefaults;
  onChange: (defaults: PingDefaults) => void;
}): ReactElement {
  const examples = ['8.8.8.8', '8.8.4.4', '1.1.1.1'];
  return (
    <ToolPanel
      title="Ping defaults"
      active={defaults.enabled}
      summary="Saved servers for your Ping tests"
    >
      <ToolControl
        label="Use saved defaults"
        name="enabled"
        value={defaults.enabled ? 'on' : 'off'}
        options={[
          ['off', 'Off'],
          ['on', 'On'],
        ]}
        onChange={(_, value) => onChange({ ...defaults, enabled: value === 'on' })}
      />
      {defaults.targets.map((target, index) => (
        <ToolField
          key={index}
          label={`Server ${index}`}
          value={target}
          placeholder={examples[index]}
          onChange={(event) => {
            const targets: PingDefaults['targets'] = [...defaults.targets];
            targets[index] = event.target.value.trim().slice(0, 127);
            onChange({ ...defaults, targets });
          }}
        />
      ))}
      <p className="tool-defaults-help">
        Turn on to prefill Ping servers. You can override them in Network & discovery. Empty servers
        keep the automatic network targets.
      </p>
    </ToolPanel>
  );
}
