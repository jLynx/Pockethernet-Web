import { AppPages } from '@/app/AppPages';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import logo from '@/assets/logo.png';
import { errorMessage } from '@/app/format';
import { NumberFormatProvider } from '@/app/NumberFormatContext';
import { runReportMeasurement } from '@/app/runReportMeasurement';
import { SUPPORTED_TESTS, type Tab, type TestId, type WorkflowMode } from '@/app/types';
import { useAppSettings } from '@/app/useAppSettings';
import { emptyResults } from '@/app/useMeasurementState';
import { useReports } from '@/app/useReports';
import { useTestingWorkflows } from '@/app/useTestingWorkflows';
import { WorkflowSelector } from '@/shared/layout/WorkflowSelector';
import { toggleSelection } from '@/app/testSelection';
import { clearReportDatabase } from '@/app/reportDatabase';
import {
  ActionDock,
  AppFooter,
  ConnectionButton,
  GitHubLink,
  Toast,
} from '@/shared/layout/AppControls';
import { MainNav } from '@/shared/layout/Layout';
import { AppUpdate } from '@/shared/layout/AppUpdate';
import { usePockethernet } from '@/device/usePockethernet';
import { useDeviceTools } from '@/features/tools/useDeviceTools';
import { useFirmwareUpdater } from '@/features/firmware/useFirmwareUpdater';
import { readPendingUpdate } from '@/features/firmware/updateRecovery';
import { updateLocked, updateWorking } from '@/features/firmware/firmwareUpdateController';
import { Button } from '@/shared/ui/UiPrimitives';

export default function App(): ReactElement {
  const [tab, setTab] = useState<Tab>('test');
  const [notice, setNotice] = useState('');
  const app = useAppSettings();
  const library = useReports();
  const testing = useTestingWorkflows(app, library, setNotice);
  const { measurement, workflow } = testing;
  const [firmwareLocked, setFirmwareLocked] = useState(
    () => !!readPendingUpdate(window.localStorage),
  );
  const ble = usePockethernet({ pollBattery: !measurement.running && !firmwareLocked });
  const deviceTools = useDeviceTools({
    client: ble,
    running: measurement.running,
    firmwareLocked,
    onNotice: setNotice,
  });
  const firmwareUpdater = useFirmwareUpdater({
    client: ble,
    onLockChange: setFirmwareLocked,
    blockedReason: deviceTools.busy
      ? 'Wait for the current device command to finish.'
      : measurement.running
        ? 'Wait for measurements to finish.'
        : app.tonerSettings.power === 'on'
          ? 'Turn off the tone generator first.'
          : app.blinkerSettings.link !== 'off'
            ? 'Turn off the port blinker first.'
            : app.wifiSettings.enabled === 'on'
              ? 'Turn off the WiFi bridge first.'
              : '',
  });
  const deviceLocked = updateLocked(firmwareUpdater.state);
  const measuring = useRef(false);
  const changeWorkflow = (mode: WorkflowMode): void => {
    if (measuring.current || testing.busy || deviceLocked || deviceTools.busy || library.busy)
      return;
    app.setWorkflowMode(mode);
    setNotice('');
  };
  useEffect(() => {
    const openResults = (event: MessageEvent<unknown>): void => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (
        typeof data === 'object' &&
        data !== null &&
        'type' in data &&
        data.type === 'pocketweb-open-results'
      )
        setTab('test');
    };
    navigator.serviceWorker?.addEventListener('message', openResults);
    window.addEventListener('message', openResults);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', openResults);
      window.removeEventListener('message', openResults);
    };
  }, []);
  const clearError = ble.clearError;
  const dismissNotice = useCallback(() => {
    setNotice('');
    clearError();
  }, [clearError]);
  const toggle = (id: TestId): void => {
    if (measurement.running || deviceLocked) return;
    app.setSelected((current) => toggleSelection(current, id));
  };
  const connect = async (): Promise<void> => {
    if (updateWorking(firmwareUpdater.state)) return;
    try {
      if (ble.status === 'connected') ble.disconnect();
      else await ble.connect();
    } catch (error) {
      const message = errorMessage(error);
      if (
        !(error instanceof DOMException && error.name === 'NotFoundError') &&
        !message.toLowerCase().includes('cancel')
      )
        setNotice(message);
    }
  };
  const measure = async (): Promise<void> => {
    if (deviceLocked || measurement.running || measuring.current || deviceTools.busy) return;
    if (ble.status !== 'connected') {
      setNotice('Connect Pockethernet first.');
      return;
    }
    if (!SUPPORTED_TESTS.some((id) => app.selected.has(id))) {
      setNotice(
        app.workflowMode === 'single'
          ? 'Choose at least one test.'
          : 'Choose at least one test in Configure.',
      );
      return;
    }
    if (!workflow.beforeMeasure()) return;
    measuring.current = true;
    if (app.workflowMode === 'batch') measurement.setResults(emptyResults());
    measurement.setDraft(null);
    setNotice('');
    try {
      await runReportMeasurement(
        {
          ...measurement.setters,
          ble,
          selected: app.selected,
          toolSettings: app.toolSettings,
          ...app.measurementSettings,
          pingTargets: app.pingTargets,
          setNotice,
        },
        measurement.setDraft,
      );
    } finally {
      measuring.current = false;
    }
  };
  const reset = async (): Promise<void> => {
    if (
      !library.ready ||
      measurement.running ||
      deviceLocked ||
      deviceTools.busy ||
      library.busy ||
      workflow.busy ||
      workflow.addingPhotos
    )
      return;
    if (
      !window.confirm(
        'Delete ALL saved reports and reset Pocketweb settings on this browser? This cannot be undone. Export any reports you need first.',
      )
    )
      return;
    try {
      await clearReportDatabase();
      const keys = Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index),
      );
      for (const key of keys) if (key?.startsWith('pockethernet.')) localStorage.removeItem(key);
      ble.disconnect();
      window.location.reload();
    } catch (error) {
      setNotice(`Reset could not finish: ${errorMessage(error)}`);
    }
  };
  const displaySettings =
    app.workflowMode === 'batch'
      ? (measurement.draft?.settings ?? app.toolSettings)
      : app.toolSettings;
  return (
    <NumberFormatProvider separator={displaySettings.decimalSeparator ?? '.'}>
      <div className="original-app">
        <header className="original-header">
          <img className="wordmark" src={logo} alt="Pocketweb for Pockethernet" />
          <div className="header-actions">
            <GitHubLink />
            <ConnectionButton
              status={ble.status}
              batteryPercent={ble.batteryPercent}
              disabled={updateWorking(firmwareUpdater.state)}
              onClick={() => void connect()}
            />
          </div>
        </header>
        <MainNav tab={tab} onChange={setTab} />
        <WorkflowSelector
          mode={app.workflowMode}
          disabled={testing.busy || deviceLocked || deviceTools.busy || library.busy}
          onChange={changeWorkflow}
        />
        <AppUpdate
          busy={
            measurement.running ||
            deviceLocked ||
            deviceTools.busy ||
            workflow.busy ||
            workflow.addingPhotos
          }
        />
        {deviceLocked && tab !== 'settings' && (
          <div className="firmware-banner" role="status">
            <span>
              {updateWorking(firmwareUpdater.state)
                ? 'Firmware update in progress'
                : 'Firmware update needs verification'}
            </span>
            <Button onClick={() => setTab('settings')}>View update</Button>
          </div>
        )}
        <AppPages
          tab={tab}
          app={app}
          measurement={measurement}
          workflow={workflow}
          library={library}
          ble={ble}
          deviceTools={deviceTools}
          firmwareUpdater={firmwareUpdater}
          deviceLocked={deviceLocked}
          onTabChange={setTab}
          onToggle={toggle}
          onReset={reset}
          onNotice={setNotice}
        />
        {tab === 'test' && (
          <ActionDock
            status={ble.status}
            selectedCount={app.selected.size}
            running={measurement.running}
            canMeasure={
              !deviceLocked &&
              !workflow.busy &&
              !workflow.addingPhotos &&
              SUPPORTED_TESTS.some((id) => app.selected.has(id))
            }
            onMeasure={() => void measure()}
          />
        )}
        <AppFooter />
        {(notice || ble.error) && <Toast message={notice || ble.error} onDismiss={dismissNotice} />}
      </div>
    </NumberFormatProvider>
  );
}
