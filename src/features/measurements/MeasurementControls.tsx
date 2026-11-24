import type { ReactElement } from 'react';
import type { TestId } from '@/app/types';
import type { useTestConfiguration } from '@/app/useTestConfiguration';
import { BerSettingsPanel } from '@/features/settings/BerSettingsPanel';
import { NetworkSettings } from '@/features/settings/NetworkSettings';

export function MeasurementControls({
  id,
  configuration,
  disabled,
  firmwareVersion,
}: {
  id: TestId;
  configuration: ReturnType<typeof useTestConfiguration>;
  disabled: boolean;
  firmwareVersion?: number;
}): ReactElement | null {
  if (
    id !== 'ber' &&
    id !== 'ipv4' &&
    id !== 'ipv6' &&
    id !== 'network-discovery' &&
    id !== 'cdplldp' &&
    id !== 'cdp' &&
    id !== 'lldp' &&
    id !== 'vlan' &&
    id !== 'ping'
  )
    return null;
  return (
    <fieldset
      className="single-test-controls"
      disabled={disabled}
      aria-label={`${id} configuration`}
    >
      {id === 'ber' ? (
        <BerSettingsPanel
          settings={configuration.measurementSettings}
          onChange={configuration.setMeasurementSettings}
        />
      ) : (
        <NetworkSettings
          section={id}
          settings={configuration.measurementSettings}
          selected={configuration.selected}
          firmwareVersion={firmwareVersion}
          onChange={configuration.setMeasurementSettings}
          pingTargets={configuration.pingTargets}
          onPingTargetsChange={configuration.setPingTargets}
        />
      )}
    </fieldset>
  );
}
