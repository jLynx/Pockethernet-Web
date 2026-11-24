import type { ReactElement } from 'react';
import type { MeasurementSettings, StateSetter, TestId } from '@/app/types';
import { DISCOVERY_LISTEN_TIMES, discoveryIsActive } from '@/app/measurementSettings';
import { firmwareRequirement, firmwareSupports } from '@/protocol/firmwareFeatures';
import { DEFAULT_DISCOVERY_PROBES, DISCOVERY_PROBES } from '@/protocol/networkDiscovery';
import { Checkbox, SelectField } from '@/shared/ui/UiPrimitives';

export function DiscoverySettings({
  settings,
  onChange,
  selected,
  firmwareVersion,
}: {
  settings: MeasurementSettings;
  onChange: StateSetter<MeasurementSettings>;
  selected: ReadonlySet<TestId>;
  firmwareVersion?: number;
}): ReactElement {
  const mode = settings.discoveryMode ?? 'active';
  const active = discoveryIsActive(selected, mode);
  const advanced =
    firmwareVersion === undefined || firmwareSupports(firmwareVersion, 'advancedDiscovery');
  const mask = settings.discoveryProbeMask ?? DEFAULT_DISCOVERY_PROBES;
  return (
    <>
      <SelectField
        label="Network Discovery mode"
        value={mode}
        onChange={(event) => {
          const value = event.target.value;
          const discoveryMode = value === 'active' || value === 'passive' ? value : 'auto';
          onChange((current) => ({ ...current, discoveryMode }));
        }}
      >
        <option value="auto">Follow IPv4 selection</option>
        <option value="active">Scan the attached IPv4 subnet and listen</option>
        <option value="passive">Listen only</option>
      </SelectField>
      <SelectField
        label="Listen before scan"
        value={settings.discoveryTimeout}
        onChange={(event) => {
          const discoveryTimeout = DISCOVERY_LISTEN_TIMES.find(
            (time) => time === Number(event.target.value),
          );
          if (discoveryTimeout) onChange((current) => ({ ...current, discoveryTimeout }));
        }}
      >
        {DISCOVERY_LISTEN_TIMES.map((time) => (
          <option key={time} value={time}>
            {time === 300000 ? '5 minutes' : `${time / 1000} seconds`}
          </option>
        ))}
      </SelectField>
      <p className="settings-hint">
        Choose 130 seconds for IGMP queriers or 5 minutes for PTP and SAP announcements.
      </p>
      {(
        [
          ['ipv4', 'Active scan methods'],
          ['layer2', 'Layer 2 probes'],
          ['device', 'Device probes'],
        ] as const
      ).map(([group, label]) => (
        <fieldset
          className="discovery-probes"
          key={group}
          disabled={(group !== 'ipv4' && !advanced) || (group !== 'layer2' && !active)}
        >
          <legend>{label}</legend>
          {group !== 'ipv4' && !advanced && (
            <p className="settings-hint">{firmwareRequirement('advancedDiscovery')}</p>
          )}
          {DISCOVERY_PROBES.filter((probe) => probe.group === group).map(({ bit, label }) => (
            <label key={bit}>
              <Checkbox
                checked={Boolean(mask & bit)}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  onChange((current) => {
                    const previous = current.discoveryProbeMask ?? DEFAULT_DISCOVERY_PROBES;
                    return {
                      ...current,
                      discoveryProbeMask: enabled ? previous | bit : previous & ~bit,
                    };
                  });
                }}
              />
              {label}
            </label>
          ))}
        </fieldset>
      ))}
    </>
  );
}
