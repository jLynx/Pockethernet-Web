import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { SavedReport } from './types';
import { useAppSettings } from './useAppSettings';
import { useTestingWorkflows } from './useTestingWorkflows';
import { workflowDraft, workflowReport } from './workflowFixtures';
import { WorkflowSelector } from '@/shared/layout/WorkflowSelector';
import { ReportComposer } from '@/features/reports/ReportComposer';
import { Button } from '@/shared/ui/UiPrimitives';

function TwoWorkflowsExample(): ReactElement {
  const app = useAppSettings();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [notice, setNotice] = useState('');
  const { measurement, workflow, busy } = useTestingWorkflows(
    app,
    {
      reports,
      ready: true,
      busy: false,
      error: '',
      add: (report) => {
        setReports((current) => [report, ...current]);
        return Promise.resolve(true);
      },
      remove: () => Promise.resolve(false),
    },
    setNotice,
  );
  const batch = app.workflowMode === 'batch';
  return (
    <div style={{ maxWidth: 900, margin: '24px auto' }}>
      <WorkflowSelector mode={app.workflowMode} disabled={busy} onChange={app.setWorkflowMode} />
      <p>This preview keeps separate drafts, settings and photos with the real workflow hooks.</p>
      <Button
        onClick={() => {
          measurement.setDraft({ ...workflowDraft(), createdAt: new Date().toISOString() });
          app.setReportDetails({ ...workflowReport().details, tag: batch ? 'CAB-009' : '' });
          workflow.setPhotos(workflowReport().photos);
        }}
      >
        Load sample measurement
      </Button>
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
        ready
        autoIncrement={batch && app.autoIncrement}
        onSave={workflow.save}
        onNotice={setNotice}
      />
      <p role="status">{notice}</p>
      <p>
        {workflow.photos.length} draft photos; {reports.length} saved reports
      </p>
    </div>
  );
}

const meta = { title: 'App/Workflow modes', component: TwoWorkflowsExample } satisfies Meta<
  typeof TwoWorkflowsExample
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const TwoWorkflows: Story = {};
