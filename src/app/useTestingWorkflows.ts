import type { useAppSettings } from './useAppSettings';
import type { ReportLibrary } from './useReports';
import { emptyResults, useMeasurementState } from './useMeasurementState';
import { useReportWorkflow } from './useReportWorkflow';

function useTestingWorkflowsInternal(
  app: ReturnType<typeof useAppSettings>,
  library: ReportLibrary,
  onNotice: (message: string) => void,
) {
  const singleMeasurement = useMeasurementState();
  const batchMeasurement = useMeasurementState();
  const singleWorkflow = useReportWorkflow({
    library,
    draft: singleMeasurement.draft,
    details: app.singleConfiguration.reportDetails,
    setDetails: app.singleConfiguration.setReportDetails,
    autoIncrement: false,
    singleTest: true,
    onNext: () => undefined,
    onNotice,
  });
  const batchWorkflow = useReportWorkflow({
    library,
    draft: batchMeasurement.draft,
    details: app.batchConfiguration.reportDetails,
    setDetails: app.batchConfiguration.setReportDetails,
    autoIncrement: app.autoIncrement,
    onNext: () => {
      batchMeasurement.setDraft(null);
      batchMeasurement.setResults(emptyResults());
      batchMeasurement.setters.setFailures?.({});
      batchMeasurement.setExpanded(new Set());
    },
    onNotice,
  });
  return {
    measurement: app.workflowMode === 'single' ? singleMeasurement : batchMeasurement,
    workflow: app.workflowMode === 'single' ? singleWorkflow : batchWorkflow,
    busy:
      singleMeasurement.running ||
      batchMeasurement.running ||
      singleWorkflow.busy ||
      batchWorkflow.busy ||
      singleWorkflow.addingPhotos ||
      batchWorkflow.addingPhotos,
  };
}

export function useTestingWorkflows(
  app: ReturnType<typeof useAppSettings>,
  library: ReportLibrary,
  onNotice: (message: string) => void,
): ReturnType<typeof useTestingWorkflowsInternal> {
  return useTestingWorkflowsInternal(app, library, onNotice);
}
