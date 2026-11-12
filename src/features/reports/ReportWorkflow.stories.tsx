import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReportDraft, SavedReport } from '@/app/types';
import { workflowDraft, workflowReport } from '@/app/workflowFixtures';
import { useReportWorkflow } from '@/app/useReportWorkflow';
import { Button } from '@/shared/ui/UiPrimitives';
import { ReportComposer } from './ReportComposer';

function BatchWorkflowExample(): ReactElement {
  const [details, setDetails] = useState(() => workflowReport('current', 'CAB-009').details);
  const [draft, setDraft] = useState<ReportDraft | null>(workflowDraft);
  const [reports, setReports] = useState<SavedReport[]>(() => [
    workflowReport('existing', 'CAB-010'),
  ]);
  const [failSave, setFailSave] = useState(false);
  const [notice, setNotice] = useState('');
  const workflow = useReportWorkflow({
    library: {
      reports,
      ready: true,
      busy: false,
      error: '',
      add: (report) => {
        if (failSave) return Promise.resolve(false);
        setReports((current) => [report, ...current]);
        return Promise.resolve(true);
      },
      remove: () => Promise.resolve(false),
    },
    draft,
    details,
    setDetails,
    autoIncrement: true,
    onNext: () => setDraft(null),
    onNotice: setNotice,
  });
  return (
    <div style={{ maxWidth: 900, margin: '24px auto' }}>
      <p>Sample workflow with CAB-010 already saved. This example uses in-memory reports.</p>
      <div className="batch-save-actions">
        <Button
          onClick={() => setDraft({ ...workflowDraft(), createdAt: new Date().toISOString() })}
        >
          Load sample measurement
        </Button>
        <label>
          <input
            type="checkbox"
            checked={failSave}
            onChange={(event) => setFailSave(event.target.checked)}
          />{' '}
          Simulate storage failure
        </label>
      </div>
      <ReportComposer
        draft={draft}
        details={details}
        onDetailsChange={setDetails}
        photos={workflow.photos}
        onPhotosChange={workflow.setPhotos}
        addingPhotos={workflow.addingPhotos}
        onAddingPhotosChange={workflow.setAddingPhotos}
        saved={workflow.saved}
        busy={workflow.busy}
        running={false}
        ready
        autoIncrement
        onSave={workflow.save}
        onNotice={setNotice}
      />
      <p role="status">{notice}</p>
      <p>
        {reports.length} saved reports: {reports.map((report) => report.details.tag).join(', ')}
      </p>
    </div>
  );
}

const meta = {
  title: 'Reports/Batch workflow',
  component: BatchWorkflowExample,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BatchWorkflowExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SaveAndNext: Story = {};
