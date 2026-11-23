import type { ReactElement } from 'react';
import type { ReportDetails, ReportDraft, ReportPhoto, StateSetter } from '@/app/types';
import { Button, SelectField, TextField } from '@/shared/ui/UiPrimitives';
import type { ReportJob } from '@/app/savedConfigurations';
import { ReportPhotos } from './ReportPhotos';

interface ReportComposerProps {
  batch?: boolean;
  draft: ReportDraft | null;
  details: ReportDetails;
  onDetailsChange: StateSetter<ReportDetails>;
  photos: ReportPhoto[];
  onPhotosChange: StateSetter<ReportPhoto[]>;
  addingPhotos: boolean;
  onAddingPhotosChange: StateSetter<boolean>;
  saved: boolean;
  busy: boolean;
  running: boolean;
  ready: boolean;
  autoIncrement: boolean;
  onSave: (advance: boolean) => Promise<void>;
  onNotice: (message: string) => void;
  jobs?: readonly ReportJob[];
  jobId?: string;
  onJobChange?: (id: string) => void;
}

const FIELDS: readonly [keyof ReportDetails, string, string][] = [
  ['project', 'Project', 'Project or job name'],
  ['address', 'Address / site', 'Site or street address'],
  ['user', 'Technician', 'Technician or customer'],
  ['location', 'Location', 'Room or rack'],
  ['portId', 'Port ID', 'Outlet or switch port'],
];

export function ReportComposer(props: ReportComposerProps): ReactElement {
  const {
    batch = true,
    draft,
    details,
    onDetailsChange,
    saved,
    busy,
    running,
    ready,
    addingPhotos,
    autoIncrement,
  } = props;
  const disabled = busy || running || addingPhotos;
  const job = props.jobs?.find((item) => item.id === props.jobId);
  return (
    <section className="report-composer batch-composer" aria-labelledby="cable-report-title">
      <header>
        <div>
          <h2 id="cable-report-title">{batch ? 'Cable report' : 'New report'}</h2>
          <p>
            {running
              ? 'Measurement in progress'
              : saved
                ? 'Report saved'
                : draft
                  ? batch
                    ? 'Results ready to save'
                    : 'Latest measurement run ready to save'
                  : batch
                    ? 'Enter the cable ID, then run your tests'
                    : 'Run tests from the Test tab to create a report'}
          </p>
        </div>
        <div className="batch-save-actions">
          <Button
            disabled={!draft || saved || disabled || !ready}
            onClick={() => void props.onSave(false)}
          >
            Save report
          </Button>
          {batch && (
            <Button
              variant="primary"
              disabled={!draft || disabled || !ready}
              onClick={() => void props.onSave(true)}
            >
              {busy ? 'Saving…' : saved ? 'Next cable' : 'Save & next'}
            </Button>
          )}
        </div>
      </header>
      <fieldset className="batch-fields" disabled={disabled || saved}>
        {!!props.jobs?.length && (
          <SelectField
            label="File under job"
            value={job?.id ?? ''}
            onChange={(event) => props.onJobChange?.(event.target.value)}
          >
            <option value="">No job</option>
            {props.jobs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
        )}
        {job?.numberPattern ? (
          <p className="batch-hint">Report number is assigned when saved.</p>
        ) : (
          <TextField
            label={batch ? 'Cable ID / Tag' : 'Tag (optional)'}
            value={details.tag}
            placeholder={batch ? 'CAB-001' : 'Cable or job tag'}
            maxLength={160}
            onChange={(event) =>
              onDetailsChange((current) => ({ ...current, tag: event.target.value }))
            }
          />
        )}
        {batch && autoIncrement && !job?.numberPattern && (
          <p className="batch-hint">
            Save & next increases the trailing number and skips IDs already saved in this project
            and site.
          </p>
        )}
        <details className="batch-project-details" open={batch ? undefined : true}>
          <summary>Project details, notes & photos</summary>
          <div className="report-fields">
            {FIELDS.map(([key, label, placeholder]) => (
              <TextField
                key={key}
                label={label}
                value={details[key] ?? ''}
                placeholder={placeholder}
                maxLength={160}
                onChange={(event) =>
                  onDetailsChange((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            ))}
            <label className="text-field report-comment">
              <span>Comment</span>
              <textarea
                value={details.comment}
                rows={3}
                onChange={(event) =>
                  onDetailsChange((current) => ({ ...current, comment: event.target.value }))
                }
              />
            </label>
          </div>
          <ReportPhotos
            photos={props.photos}
            onPhotosChange={props.onPhotosChange}
            busy={addingPhotos}
            onBusyChange={props.onAddingPhotosChange}
            onNotice={props.onNotice}
          />
        </details>
      </fieldset>
      {draft && Object.keys(draft.failures).length > 0 && (
        <p className="batch-hint" role="status">
          This run includes failed or interrupted tests. The report will record these failures.
        </p>
      )}
    </section>
  );
}
