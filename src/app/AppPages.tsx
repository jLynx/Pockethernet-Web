import type { ReactElement, ReactNode } from 'react';
import type { Tab, TestId, UnavailableTests } from './types';
import type { useAppSettings } from './useAppSettings';
import type { useMeasurementState } from './useMeasurementState';
import type { useReportWorkflow } from './useReportWorkflow';
import type { ReportLibrary } from './useReports';
import type { PockethernetClient } from '@/device/usePockethernet';
import type { useDeviceTools } from '@/features/tools/useDeviceTools';
import type { FirmwareUpdaterActions } from '@/features/firmware/useFirmwareUpdater';
import { TestPage } from '@/features/measurements/TestPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { ReportComposer } from '@/features/reports/ReportComposer';
import { ToolsPage } from '@/features/tools/ToolsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ConfigurePage } from '@/features/settings/ConfigurePage';

interface AppPagesProps {
  tab: Tab;
  app: ReturnType<typeof useAppSettings>;
  measurement: ReturnType<typeof useMeasurementState>;
  workflow: ReturnType<typeof useReportWorkflow>;
  library: ReportLibrary;
  ble: PockethernetClient;
  deviceTools: ReturnType<typeof useDeviceTools>;
  firmwareUpdater: FirmwareUpdaterActions;
  deviceLocked: boolean;
  unavailableTests: UnavailableTests;
  onTabChange: (tab: Tab) => void;
  onToggle: (id: TestId) => void;
  onReset: () => Promise<void>;
  onNotice: (message: string) => void;
  workflowSelector?: ReactNode;
}

export function AppPages({
  tab,
  app,
  measurement,
  workflow,
  library,
  ble,
  deviceTools,
  firmwareUpdater,
  deviceLocked,
  unavailableTests,
  onTabChange,
  onToggle,
  onReset,
  onNotice,
  workflowSelector,
}: AppPagesProps): ReactElement {
  const batch = app.workflowMode === 'batch';
  const connectedFirmwareVersion = ble.status === 'connected' ? ble.info?.espVersion : undefined;
  const displaySettings =
    batch && measurement.draft
      ? { ...measurement.draft.settings, ...app.measurementDisplay }
      : app.toolSettings;
  const composer = (
    <ReportComposer
      batch={batch}
      draft={measurement.draft}
      details={app.reportDetails}
      onDetailsChange={app.setReportDetails}
      photos={workflow.photos}
      onPhotosChange={workflow.setPhotos}
      addingPhotos={workflow.addingPhotos}
      onAddingPhotosChange={workflow.setAddingPhotos}
      saved={workflow.saved}
      busy={workflow.busy}
      running={measurement.running}
      ready={library.ready}
      autoIncrement={batch && (app.project?.incrementCableId ?? app.autoIncrement)}
      onSave={workflow.save}
      onNotice={onNotice}
      projects={app.projects}
      project={app.project}
      onProjectChange={app.setProjectId}
    />
  );
  return tab === 'test' ? (
    <TestPage
      batch={batch}
      configuration={app}
      firmwareVersion={connectedFirmwareVersion}
      disabled={measurement.running || deviceLocked}
      unavailableTests={unavailableTests}
      {...measurement.results}
      selected={
        batch && measurement.draft ? new Set(measurement.draft.selectedTests) : app.selected
      }
      expanded={measurement.expanded}
      onToggle={onToggle}
      onExpandedChange={measurement.setExpanded}
      running={measurement.running}
      activeTest={measurement.activeTest}
      failures={measurement.failures}
      pendingTests={measurement.pendingTests}
      toolSettings={displaySettings}
      onOpenConfigure={() => onTabChange('configure')}
      workflowSelector={workflowSelector}
    >
      {library.error && (
        <p className="batch-storage-error" role="alert">
          Report storage: {library.error}. Results and photos remain available in this session.
        </p>
      )}
      {batch && composer}
    </TestPage>
  ) : tab === 'tools' ? (
    <ToolsPage
      firmwareLocked={deviceLocked || measurement.running || deviceTools.busy}
      firmwareVersion={ble.info?.espVersion}
      blinkerSettings={app.blinkerSettings}
      onBlinkerSettingsChange={app.setBlinkerSettings}
      onBlinkerChange={deviceTools.applyBlinker}
      tonerSettings={app.tonerSettings}
      onTonerSettingsChange={app.setTonerSettings}
      onTonerChange={deviceTools.applyToner}
      wifiSettings={app.wifiSettings}
      bridgeSpeed={deviceTools.bridgeSpeed}
      onWifiSettingsChange={app.setWifiSettings}
      onWifiChange={deviceTools.applyWifi}
      onNotice={onNotice}
    />
  ) : tab === 'configure' ? (
    <ConfigurePage
      app={app}
      lastTdr={measurement.lastTdr}
      firmwareVersion={connectedFirmwareVersion}
      disabled={measurement.running || deviceLocked}
      unavailableTests={unavailableTests}
      onToggle={onToggle}
      onNotice={onNotice}
      workflowSelector={workflowSelector}
    />
  ) : tab === 'settings' ? (
    <SettingsPage
      deviceInfo={ble.info}
      firmwareUpdater={firmwareUpdater}
      measurementDisplay={app.measurementDisplay}
      onMeasurementDisplayChange={app.setMeasurementDisplay}
      resetDisabled={
        !library.ready ||
        measurement.running ||
        deviceLocked ||
        deviceTools.busy ||
        library.busy ||
        workflow.busy ||
        workflow.addingPhotos
      }
      onReset={onReset}
    />
  ) : (
    <ReportsPage
      preferences={app.reportPreferences}
      reports={library.reports}
      projects={app.projects}
      onRemove={library.remove}
      ready={library.ready}
      busy={library.busy}
      error={library.error}
      onNotice={onNotice}
    >
      {!batch && composer}
    </ReportsPage>
  );
}
