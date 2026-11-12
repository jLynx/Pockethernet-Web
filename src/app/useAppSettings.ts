import {
  loadBlinkerSettings,
  loadReportPreferences,
  loadTonerSettings,
  loadWifiSettings,
} from './storage';
import { useStoredState } from './useStoredState';
import { useTestConfiguration } from './useTestConfiguration';
import { loadWorkflowMode } from './workflowMode';

function useAppSettingsInternal() {
  const [workflowMode, setWorkflowMode] = useStoredState(
    'pockethernet.workflowMode',
    loadWorkflowMode,
  );
  const singleConfiguration = useTestConfiguration('pockethernet.single.');
  const batchConfiguration = useTestConfiguration('pockethernet.');
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
  const [reportPreferences, setReportPreferences] = useStoredState(
    'pockethernet.reportPreferences',
    loadReportPreferences,
  );
  const [autoIncrement, setAutoIncrement] = useStoredState('pockethernet.autoIncrement', () => {
    try {
      return localStorage.getItem('pockethernet.autoIncrement') === 'true';
    } catch {
      return false;
    }
  });
  return {
    ...(workflowMode === 'single' ? singleConfiguration : batchConfiguration),
    workflowMode,
    setWorkflowMode,
    singleConfiguration,
    batchConfiguration,
    blinkerSettings,
    setBlinkerSettings,
    tonerSettings,
    setTonerSettings,
    wifiSettings,
    setWifiSettings,
    reportPreferences,
    setReportPreferences,
    autoIncrement,
    setAutoIncrement,
  };
}

export function useAppSettings(): ReturnType<typeof useAppSettingsInternal> {
  return useAppSettingsInternal();
}
