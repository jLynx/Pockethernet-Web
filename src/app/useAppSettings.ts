import { useEffect, useState } from 'react';
import type { StateSetter } from './types';
import {
  loadBlinkerSettings,
  loadPingDefaults,
  loadReportDetails,
  loadReportPreferences,
  loadTonerSettings,
  loadToolSettings,
  loadWifiSettings,
} from './storage';
import { loadMeasurementSettings } from './measurementSettings';
import { initialPingTargets, updatePingTargets } from './pingDefaults';
import { loadSelection } from './testSelection';

function useStoredState<T>(key: string, load: () => T): [T, StateSetter<T>] {
  const [value, setValue] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Keep settings usable when browser storage is unavailable. */
    }
  }, [key, value]);
  return [value, setValue];
}

function useAppSettingsInternal() {
  const [toolSettings, setToolSettings] = useStoredState(
    'pockethernet.toolSettings',
    loadToolSettings,
  );
  const [blinkerSettings, setBlinkerSettings] = useStoredState(
    'pockethernet.blinkerSettings',
    loadBlinkerSettings,
  );
  const [tonerSettings, setTonerSettings] = useStoredState(
    'pockethernet.tonerSettings',
    loadTonerSettings,
  );
  const [wifiSettings, setWifiSettings] = useStoredState(
    'pockethernet.wifiSettings',
    loadWifiSettings,
  );
  const [reportDetails, setReportDetails] = useStoredState(
    'pockethernet.reportDetails',
    loadReportDetails,
  );
  const [reportPreferences, setReportPreferences] = useStoredState(
    'pockethernet.reportPreferences',
    loadReportPreferences,
  );
  const [measurementSettings, setMeasurementSettings] = useStoredState(
    'pockethernet.measurementSettings',
    loadMeasurementSettings,
  );
  const [pingDefaults, setPingDefaults] = useStoredState(
    'pockethernet.pingDefaults',
    loadPingDefaults,
  );
  const [pingTargets, setPingTargets] = useStoredState('pockethernet.pingTargets', () => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('pockethernet.pingTargets') ?? 'null');
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
  const [selected, setSelected] = useState(loadSelection);
  const [autoIncrement, setAutoIncrement] = useStoredState('pockethernet.autoIncrement', () => {
    try {
      return localStorage.getItem('pockethernet.autoIncrement') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('pockethernet.selectedTests', JSON.stringify([...selected]));
    } catch {
      /* Selection still works for this session. */
    }
  }, [selected]);
  const changePingDefaults = (next: typeof pingDefaults): void => {
    setPingTargets((current) => updatePingTargets(current, pingDefaults, next));
    setPingDefaults(next);
  };
  return {
    toolSettings,
    setToolSettings,
    blinkerSettings,
    setBlinkerSettings,
    tonerSettings,
    setTonerSettings,
    wifiSettings,
    setWifiSettings,
    reportDetails,
    setReportDetails,
    reportPreferences,
    setReportPreferences,
    measurementSettings,
    setMeasurementSettings,
    pingDefaults,
    changePingDefaults,
    pingTargets,
    setPingTargets,
    selected,
    setSelected,
    autoIncrement,
    setAutoIncrement,
  };
}

export function useAppSettings(): ReturnType<typeof useAppSettingsInternal> {
  return useAppSettingsInternal();
}
