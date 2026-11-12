import type { ReactElement } from 'react';
import type { ReportDetails, ReportDraft, ReportPhoto, StateSetter } from '@/app/types';
import { Button, TextField } from '@/shared/ui/UiPrimitives';
import { ReportPhotos } from './ReportPhotos';

interface ReportComposerProps {
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
  return (
    <section className="report-composer batch-composer" aria-labelledby="cable-report-title">
      <header>
        <div>
          <h2 id="cable-report-title">Cable report</h2>
          <p>
            {running
              ? 'Measurement in progress'
              : saved
                ? 'Report saved'
                : draft
                  ? 'Results ready to save'
                  : 'Enter the cable ID, then run your tests'}
          </p>
        </div>
        <div className="batch-save-actions">
          <Button
            disabled={!draft || saved || disabled || !ready}
            onClick={() => void props.onSave(false)}
          >
            Save report
          </Button>
          <Button
            variant="primary"
            disabled={!draft || disabled || !ready}
            onClick={() => void props.onSave(true)}
          >
            {busy ? 'Saving…' : saved ? 'Next cable' : 'Save & next'}
          </Button>
        </div>
      </header>
      <fieldset className="batch-fields" disabled={disabled || saved}>
        <TextField
          label="Cable ID / Tag"
          value={details.tag}
          placeholder="CAB-001"
          maxLength={160}
          onChange={(event) =>
            onDetailsChange((current) => ({ ...current, tag: event.target.value }))
          }
        />
        {autoIncrement && (
          <p className="batch-hint">
            Save & next increases the trailing number and skips IDs already saved in this project
            and site.
          </p>
        )}
        <details className="batch-project-details">
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
