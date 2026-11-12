import type { ReactElement } from 'react';
import type { Tab, TestId } from './types';
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
  onTabChange: (tab: Tab) => void;
  onToggle: (id: TestId) => void;
  onReset: () => Promise<void>;
  onNotice: (message: string) => void;
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
  onTabChange,
  onToggle,
  onReset,
  onNotice,
}: AppPagesProps): ReactElement {
  const batch = app.workflowMode === 'batch';
  const displaySettings = batch
    ? (measurement.draft?.settings ?? app.toolSettings)
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
      autoIncrement={batch && app.autoIncrement}
      onSave={workflow.save}
      onNotice={onNotice}
    />
  );
  return tab === 'test' ? (
    <TestPage
      batch={batch}
      configuration={app}
      disabled={measurement.running || deviceLocked}
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
      firmwareLocked={deviceLocked || measurement.running}
      blinkerSettings={app.blinkerSettings}
      onBlinkerSettingsChange={app.setBlinkerSettings}
      onBlinkerChange={deviceTools.applyBlinker}
      tonerSettings={app.tonerSettings}
      onTonerSettingsChange={app.setTonerSettings}
      onTonerChange={deviceTools.applyToner}
      wifiSettings={app.wifiSettings}
      onWifiSettingsChange={app.setWifiSettings}
      onWifiChange={deviceTools.applyWifi}
    />
  ) : tab === 'configure' ? (
    <ConfigurePage
      app={app}
      disabled={measurement.running || deviceLocked}
      onToggle={onToggle}
      onNotice={onNotice}
    />
  ) : tab === 'settings' ? (
    <SettingsPage
      deviceInfo={ble.info}
      firmwareUpdater={firmwareUpdater}
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
