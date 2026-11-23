import {
  loadBlinkerSettings,
  loadReportPreferences,
  loadTonerSettings,
  loadWifiSettings,
} from './storage';
import { useStoredState } from './useStoredState';
import { useTestConfiguration } from './useTestConfiguration';
import { loadWorkflowMode } from './workflowMode';
import { loadNamedItems, type MeasurementPreset, type ReportJob } from './savedConfigurations';

const PRESETS = 'pockethernet.measurementPresets';
const JOBS = 'pockethernet.reportJobs';

function useAppSettingsInternal() {
  const [workflowMode, setWorkflowMode] = useStoredState(
    'pockethernet.workflowMode',
    loadWorkflowMode,
  );
  const singleConfiguration = useTestConfiguration('pockethernet.single.');
  const batchConfiguration = useTestConfiguration('pockethernet.');
  const [presets, setPresets] = useStoredState(PRESETS, () =>
    loadNamedItems<MeasurementPreset>(
      PRESETS,
      (item) =>
        (item.mode === 'single' || item.mode === 'batch') &&
        Array.isArray(item.selected) &&
        !!item.toolSettings &&
        !!item.measurementSettings &&
        Array.isArray(item.pingTargets),
    ),
  );
  const [jobs, setJobs] = useStoredState(JOBS, () =>
    loadNamedItems<ReportJob>(
      JOBS,
      (item) => typeof item.site === 'string' && typeof item.numberPattern === 'string',
    ),
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
  const configuration = workflowMode === 'single' ? singleConfiguration : batchConfiguration;
  const selectReportJob = (job?: ReportJob): void => {
    configuration.setJobId(job?.id ?? '');
    if (job) {
      configuration.setReportDetails((current) => ({
        ...current,
        project: job.name,
        address: job.site,
      }));
    }
  };
  return {
    ...configuration,
    workflowMode,
    setWorkflowMode,
    singleConfiguration,
    batchConfiguration,
    presets,
    setPresets,
    jobs,
    setJobs,
    selectReportJob,
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
