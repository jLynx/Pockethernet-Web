import {
  loadBlinkerSettings,
  loadMeasurementDisplay,
  loadReportPreferences,
  loadTonerSettings,
  loadWifiSettings,
  MEASUREMENT_DISPLAY_KEY,
} from './storage';
import { useStoredState } from './useStoredState';
import { useTestConfiguration } from './useTestConfiguration';
import { loadWorkflowMode } from './workflowMode';
import { loadNamedItems, type MeasurementPreset, type ReportProject } from './savedConfigurations';

const PRESETS = 'pockethernet.measurementPresets';
const PROJECTS = 'pockethernet.reportJobs';

function useAppSettingsInternal() {
  const [workflowMode, setWorkflowMode] = useStoredState(
    'pockethernet.workflowMode',
    loadWorkflowMode,
  );
  const single = useTestConfiguration('pockethernet.single.');
  const batch = useTestConfiguration('pockethernet.');
  const [measurementDisplay, setMeasurementDisplay] = useStoredState(MEASUREMENT_DISPLAY_KEY, () =>
    loadMeasurementDisplay(workflowMode),
  );
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
  const [projects, setProjects] = useStoredState(PROJECTS, () =>
    loadNamedItems<ReportProject>(
      PROJECTS,
      (item) =>
        typeof item.site === 'string' &&
        typeof item.numberPattern === 'string' &&
        (item.incrementCableId === undefined || typeof item.incrementCableId === 'boolean'),
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
  const withProject = (configuration: ReturnType<typeof useTestConfiguration>) => {
    const project = projects.find((item) => item.id === configuration.projectId);
    const reportDetails = project
      ? { ...configuration.reportDetails, project: project.name, address: project.site }
      : configuration.reportDetails;
    const toolSettings = { ...configuration.toolSettings, ...measurementDisplay };
    return { ...configuration, project, reportDetails, toolSettings };
  };
  const singleConfiguration = withProject(single);
  const batchConfiguration = withProject(batch);
  const configuration = workflowMode === 'single' ? singleConfiguration : batchConfiguration;
  const removeProject = (id: string): void => {
    setProjects((current) => current.filter((project) => project.id !== id));
    single.setProjectId((current) => (current === id ? '' : current));
    batch.setProjectId((current) => (current === id ? '' : current));
  };
  return {
    ...configuration,
    workflowMode,
    setWorkflowMode,
    singleConfiguration,
    batchConfiguration,
    measurementDisplay,
    setMeasurementDisplay,
    presets,
    setPresets,
    projects,
    setProjects,
    removeProject,
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
