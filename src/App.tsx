import { AppPages } from '@/app/AppPages';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import logo from '@/assets/logo.png';
import { errorMessage } from '@/app/format';
import { NumberFormatProvider } from '@/app/NumberFormatContext';
import { runReportMeasurement } from '@/app/runReportMeasurement';
import type { Tab, TestId, WorkflowMode } from '@/app/types';
import { useAppSettings } from '@/app/useAppSettings';
import { emptyResults } from '@/app/useMeasurementState';
import { useReports } from '@/app/useReports';
import { useTestingWorkflows } from '@/app/useTestingWorkflows';
import { WorkflowSelector } from '@/shared/layout/WorkflowSelector';
import { testSelectionForDevice, toggleSelection } from '@/app/testSelection';
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
  const ble = usePockethernet({
    pollBattery: !measurement.running && !firmwareLocked,
    autoReconnect: !firmwareLocked,
  });
  const { runnableTests, unavailableTests } = testSelectionForDevice(
    app.selected,
    ble.status === 'connected',
    ble.info?.espVersion,
  );
  const deviceTools = useDeviceTools({
    client: ble,
    running: measurement.running,
    firmwareLocked,
    wifiEnabled: app.wifiSettings.enabled === 'on',
    otherToolActive: app.tonerSettings.power === 'on' || app.blinkerSettings.link !== 'off',
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
  const measuring = useRef<AbortController | null>(null);
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
    if (unavailableTests[id]) return;
    app.setSelected((current) => toggleSelection(current, id));
  };
  const connect = async (): Promise<void> => {
    if (updateWorking(firmwareUpdater.state)) return;
    try {
      if (ble.status === 'connected' || ble.status === 'reconnecting') ble.disconnect();
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
    if (app.wifiSettings.enabled === 'on') {
      setNotice('Turn off the WiFi bridge before measuring.');
      return;
    }
    if (!runnableTests.size) {
      setNotice(
        [...app.selected].map((id) => unavailableTests[id]).find(Boolean) ??
          (app.workflowMode === 'single'
            ? 'Choose at least one test.'
            : 'Choose at least one test in Configure.'),
      );
      return;
    }
    if (!workflow.beforeMeasure()) return;
    const run = new AbortController();
    measuring.current = run;
    if (app.workflowMode === 'batch') measurement.setResults(emptyResults());
    measurement.setDraft(null);
    setNotice('');
    try {
      await runReportMeasurement(
        {
          ...measurement.setters,
          ble,
          signal: run.signal,
          selected: runnableTests,
          toolSettings: app.toolSettings,
          ...app.measurementSettings,
          pingTargets: app.pingTargets,
          setNotice,
        },
        measurement.setDraft,
      );
    } finally {
      measuring.current = null;
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
  const feedback = ble.idleShutdown
    ? 'Pockethernet may have switched off after being idle. Turn it on and reconnect.'
    : (ble.status === 'disconnected' && ble.error) || notice || ble.error;
  return (
    <NumberFormatProvider separator={app.measurementDisplay.decimalSeparator}>
      <div className="original-app">
        <header className="original-header">
          <img className="wordmark" src={logo} alt="Pocketweb for Pockethernet" />
          <div className="header-actions">
            <GitHubLink />
            <ConnectionButton
              status={ble.status}
              batteryPercent={ble.batteryPercent}
              batteryCharging={ble.batteryCharging}
              disabled={updateWorking(firmwareUpdater.state)}
              onClick={() => void connect()}
            />
          </div>
        </header>
        <MainNav tab={tab} onChange={setTab} />
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
          unavailableTests={unavailableTests}
          onTabChange={setTab}
          onToggle={toggle}
          onReset={reset}
          onNotice={setNotice}
          workflowSelector={
            <WorkflowSelector
              mode={app.workflowMode}
              disabled={testing.busy || deviceLocked || deviceTools.busy || library.busy}
              onChange={changeWorkflow}
            />
          }
        />
        {tab === 'test' && (
          <ActionDock
            status={ble.status}
            selectedCount={runnableTests.size}
            running={measurement.running}
            canMeasure={
              !deviceLocked && !workflow.busy && !workflow.addingPhotos && runnableTests.size > 0
            }
            onMeasure={() => void measure()}
            onStop={() => measuring.current?.abort()}
          />
        )}
        <AppFooter />
        {feedback && <Toast message={feedback} onDismiss={dismissNotice} />}
      </div>
    </NumberFormatProvider>
  );
}
