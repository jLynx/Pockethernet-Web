import { useState, type ReactElement, type ReactNode } from 'react';
import type { ReportPreferences, ReportResults, SavedReport } from '@/app/types';
import { Button, EmptyState, SelectField } from '@/shared/ui/UiPrimitives';
import { PageLayout } from '@/shared/layout/PageLayout';
import { createLlmExport } from './llmExport';
import { downloadReportsPdf, previewReportPdf, shareReportPdf } from './pdf';

interface ReportsPageProps {
  children?: ReactNode;
  preferences: ReportPreferences;
  reports: SavedReport[];
  onRemove: (id: string) => Promise<boolean>;
  busy: boolean;
  ready: boolean;
  error: string;
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

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard copy failed');
}

export function ReportsPage({
  children,
  preferences,
  reports,
  onRemove,
  busy,
  ready,
  error,
  onNotice,
}: ReportsPageProps): ReactElement {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [project, setProject] = useState('');
  const visibleReports = reports.filter((report) => !project || report.details.project === project);
  const selectedReports = visibleReports.filter((report) => selected.has(report.id));
  const projects = [...new Set(reports.map((report) => report.details.project ?? ''))]
    .filter(Boolean)
    .sort();
  const remove = async (id: string): Promise<void> => {
    if (!(await onRemove(id))) return;
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const copyForLlm = async (selectedReports: SavedReport[]): Promise<void> => {
    if (selectedReports.length === 0) return;
    try {
      await writeClipboard(createLlmExport(selectedReports));
      onNotice(
        selectedReports.length === 1
          ? 'LLM-ready report copied to clipboard.'
          : `${selectedReports.length} LLM-ready reports copied to clipboard.`,
      );
    } catch {
      onNotice('Could not copy the report. Clipboard access may be blocked by this browser.');
    }
  };

  return (
    <PageLayout
      className="reports-page"
      eyebrow="Measurement history"
      title="Reports"
      description="View, export, and share your saved measurement reports."
    >
      {error && <p role="alert">{error}</p>}
      {children}
      {!ready && !error && <p role="status">Loading saved reports…</p>}
      <SelectField
        label="Filter by project"
        value={project}
        onChange={(event) => {
          setProject(event.target.value);
          setSelected(new Set());
        }}
      >
        <option value="">All projects</option>
        {projects.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </SelectField>
      <section className="report-library" aria-labelledby="saved-reports-title">
        <header>
          <div>
            <h2 id="saved-reports-title">Saved reports</h2>
            <p>{reports.length} stored on this device</p>
          </div>
          <Button
            disabled={selectedReports.length === 0 || busy}
            onClick={() =>
              downloadReportsPdf(
                selectedReports,
                preferences.logoDataUrl,
                preferences.showFooterLogo,
              )
            }
          >
            Export selected PDF
          </Button>
        </header>
        {reports.length === 0 ? (
          <EmptyState className="reports-empty">
            {children
              ? 'Run tests, then save a report here to add it to your history.'
              : 'Save reports from the Test tab to see them here.'}
          </EmptyState>
        ) : (
          <div className="report-list">
            {visibleReports.map((report) => (
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
                    {report.photos.length > 0 &&
                      ` · ${report.photos.length} image${report.photos.length === 1 ? '' : 's'}`}
                  </span>
                  {(report.details.location || report.details.portId) && (
                    <small>
                      {[report.details.location, report.details.portId].filter(Boolean).join(' · ')}
                    </small>
                  )}
                </div>
                <div className="report-actions">
                  <Button
                    onClick={() =>
                      previewReportPdf(report, preferences.logoDataUrl, preferences.showFooterLogo)
                    }
                  >
                    View
                  </Button>
                  <Button
                    onClick={() =>
                      downloadReportsPdf(
                        [report],
                        preferences.logoDataUrl,
                        preferences.showFooterLogo,
                      )
                    }
                  >
                    PDF
                  </Button>
                  <Button onClick={() => void copyForLlm([report])}>Copy for LLM</Button>
                  <Button
                    onClick={() =>
                      void shareReportPdf(
                        report,
                        preferences.logoDataUrl,
                        preferences.showFooterLogo,
                      )
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
                    disabled={busy || !ready}
                    onClick={() => void remove(report.id)}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
