import { useEffect, useState } from 'react';
import { loadPingDefaults, loadReportDetails, loadToolSettings } from './storage';
import { loadMeasurementSettings } from './measurementSettings';
import { initialPingTargets, updatePingTargets } from './pingDefaults';
import { loadSelection } from './testSelection';
import { useStoredState } from './useStoredState';
import { configurationKey } from './workflowMode';

function useTestConfigurationInternal(prefix: string) {
  const [toolSettings, setToolSettings] = useStoredState(`${prefix}toolSettings`, () =>
    loadToolSettings(configurationKey(prefix, 'toolSettings')),
  );
  const [reportDetails, setReportDetails] = useStoredState(`${prefix}reportDetails`, () =>
    loadReportDetails(configurationKey(prefix, 'reportDetails')),
  );
  const [measurementSettings, setMeasurementSettings] = useStoredState(
    `${prefix}measurementSettings`,
    () => loadMeasurementSettings(configurationKey(prefix, 'measurementSettings')),
  );
  const [pingDefaults, setPingDefaults] = useStoredState(`${prefix}pingDefaults`, () =>
    loadPingDefaults(configurationKey(prefix, 'pingDefaults')),
  );
  const [pingTargets, setPingTargets] = useStoredState(`${prefix}pingTargets`, () => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(configurationKey(prefix, 'pingTargets')) ?? 'null',
      );
      if (
        Array.isArray(saved) &&
        saved.length === 3 &&
        saved.every((target): target is string => typeof target === 'string')
      )
        return saved;
    } catch {
      /* Use the configured defaults. */
    }
    return initialPingTargets(pingDefaults);
  });
  const [selected, setSelected] = useState(() =>
    loadSelection(configurationKey(prefix, 'selectedTests')),
  );
  useEffect(() => {
    try {
      localStorage.setItem(`${prefix}selectedTests`, JSON.stringify([...selected]));
    } catch {
      /* Selection still works for this session. */
    }
  }, [prefix, selected]);
  const changePingDefaults = (next: typeof pingDefaults): void => {
    setPingTargets((current) => updatePingTargets(current, pingDefaults, next));
    setPingDefaults(next);
  };
  return {
    toolSettings,
    setToolSettings,
    reportDetails,
    setReportDetails,
    measurementSettings,
    setMeasurementSettings,
    pingDefaults,
    changePingDefaults,
    pingTargets,
    setPingTargets,
    selected,
    setSelected,
  };
}

export function useTestConfiguration(
  prefix: string,
): ReturnType<typeof useTestConfigurationInternal> {
  return useTestConfigurationInternal(prefix);
}
