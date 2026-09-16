import { useState, type ChangeEvent, type ReactElement } from 'react';
import type {
  ReportDetails,
  ReportPreferences,
  ReportResults,
  SavedReport,
  StateSetter,
  ToolSettings,
} from '@/app/types';
import { Button, EmptyState, PageHeader, TextField } from '@/shared/ui/UiPrimitives';
import { resizeReportImage } from './images';
import { downloadReportsPdf, previewReportPdf, shareReportPdf } from './pdf';

const FIELDS: readonly [keyof ReportDetails, string, string][] = [
  ['address', 'Address', 'Site or street address'],
  ['tag', 'Tag', 'Cable or job tag'],
  ['user', 'User', 'Technician or customer'],
  ['location', 'Location', 'Room or rack'],
  ['portId', 'Port ID', 'Outlet or switch port'],
  ['comment', 'Comment', 'Report notes'],
];

interface ReportsPageProps {
  details: ReportDetails;
  onDetailsChange: StateSetter<ReportDetails>;
  preferences: ReportPreferences;
  reports: SavedReport[];
  onReportsChange: StateSetter<SavedReport[]>;
  currentResults: ReportResults;
  toolSettings: ToolSettings;
  onNotice: (message: string) => void;
}

function reportTitle(report: SavedReport): string {
  return (
    report.details.tag ||
    report.details.address ||
    `Report ${new Date(report.createdAt).toLocaleDateString()}`
  );
}

function measuredCount(results: ReportResults): number {
  return Object.values(results).filter(Boolean).length;
}

export function ReportsPage({
  details,
  onDetailsChange,
  preferences,
  reports,
  onReportsChange,
  currentResults,
  toolSettings,
  onNotice,
}: ReportsPageProps): ReactElement {
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const count = measuredCount(currentResults);

  const addPhoto = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setPhotoDataUrl(await resizeReportImage(file));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not read this image.');
    }
    event.target.value = '';
  };

  const save = (): void => {
    if (count === 0) {
      onNotice('Run at least one measurement before saving a report.');
      return;
    }
    const report: SavedReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      details: { ...details },
      settings: { tia: toolSettings.tia, units: toolSettings.units, nvp: toolSettings.nvp },
      results: structuredClone(currentResults),
      photoDataUrl,
    };
    onReportsChange((current) => [report, ...current]);
    setPhotoDataUrl('');
    onNotice('Measurement report saved.');
  };

  const remove = (id: string): void => {
    onReportsChange((current) => current.filter((report) => report.id !== id));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  return (
    <main className="reports-page">
      <PageHeader
        className="reports-header"
        eyebrow="Measurement history"
        title="Reports"
        description="Save the current test results, then download or share a branded PDF."
      />
      <section className="report-composer" aria-labelledby="new-report-title">
        <header>
          <div>
            <h2 id="new-report-title">New report</h2>
            <p>
              {count
                ? `${count} completed measurement${count === 1 ? '' : 's'} ready`
                : 'No completed measurements yet'}
            </p>
          </div>
          <Button variant="primary" disabled={count === 0} onClick={save}>
            Save report
          </Button>
        </header>
        <div className="report-fields">
          {FIELDS.map(([key, label, placeholder]) => (
            <TextField
              key={key}
              label={label}
              value={details[key]}
              placeholder={placeholder}
              onChange={(event) =>
                onDetailsChange((current) => ({
                  ...current,
                  [key]: event.target.value.slice(0, 160),
                }))
              }
            />
          ))}
        </div>
        <div className="report-photo-row">
          <span>Report image</span>
          {photoDataUrl && <img src={photoDataUrl} alt="Report attachment preview" />}
          <label className="report-file-button">
            {photoDataUrl ? 'Replace image' : 'Add image'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => void addPhoto(event)}
            />
          </label>
          {photoDataUrl && (
            <Button variant="ghost" onClick={() => setPhotoDataUrl('')}>
              Remove
            </Button>
          )}
        </div>
      </section>

      <section className="report-library" aria-labelledby="saved-reports-title">
        <header>
          <div>
            <h2 id="saved-reports-title">Saved reports</h2>
            <p>{reports.length} stored on this device</p>
          </div>
          <Button
            disabled={selected.size < 2}
            onClick={() =>
              downloadReportsPdf(
                reports.filter((report) => selected.has(report.id)),
                preferences.logoDataUrl,
              )
            }
          >
            Export selected PDF
          </Button>
        </header>
        {reports.length === 0 ? (
          <EmptyState className="reports-empty">
            Saved measurement reports will appear here.
          </EmptyState>
        ) : (
          <div className="report-list">
            {reports.map((report) => (
              <article className="report-row" key={report.id}>
                <input
                  type="checkbox"
                  checked={selected.has(report.id)}
                  aria-label={`Select ${reportTitle(report)}`}
                  onChange={() =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (next.has(report.id)) next.delete(report.id);
                      else next.add(report.id);
                      return next;
                    })
                  }
                />
                <div className="report-row-copy">
                  <strong>{reportTitle(report)}</strong>
                  <span>
                    {new Date(report.createdAt).toLocaleString()} · {measuredCount(report.results)}{' '}
                    tests
                  </span>
                  {(report.details.location || report.details.portId) && (
                    <small>
                      {[report.details.location, report.details.portId].filter(Boolean).join(' · ')}
                    </small>
                  )}
                </div>
                <div className="report-actions">
                  <Button onClick={() => previewReportPdf(report, preferences.logoDataUrl)}>
                    View
                  </Button>
                  <Button onClick={() => downloadReportsPdf([report], preferences.logoDataUrl)}>
                    PDF
                  </Button>
                  <Button
                    onClick={() =>
                      void shareReportPdf(report, preferences.logoDataUrl)
                        .then((shared) => {
                          if (!shared)
                            onNotice(
                              'Sharing is not supported here. The PDF can still be downloaded.',
                            );
                        })
                        .catch(() => undefined)
                    }
                  >
                    Share
                  </Button>
                  <Button
                    variant="ghost"
                    className="report-delete"
                    onClick={() => remove(report.id)}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
