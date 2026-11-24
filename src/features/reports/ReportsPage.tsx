import { useState, type ReactElement, type ReactNode } from 'react';
import type { ReportPreferences, ReportResults, SavedReport } from '@/app/types';
import type { ReportProject } from '@/app/savedConfigurations';
import { reportProjectNames } from '@/app/reportWorkflow';
import { Button, Checkbox, EmptyState, SelectField } from '@/shared/ui/UiPrimitives';
import { PageLayout } from '@/shared/layout/PageLayout';
import { createLlmExport } from './llmExport';
import { createReportCsv, createReportJson } from './reportDataExport';
import {
  downloadCombinedReportsPdf,
  downloadReportsPdf,
  previewReportPdf,
  reportPdfFiles,
  shareReportPdf,
} from './pdf';
import {
  createReportsZip,
  downloadReportBlob,
  pickReportFolder,
  saveReportFilesToFolder,
  supportsReportFolder,
} from './reportFiles';
import { isReportSort, REPORT_SORT_OPTIONS, sortReports, type ReportSort } from './reportSort';

const EXPORT_OPTIONS = [
  {
    mode: 'individual',
    label: 'Individual PDFs',
    action: 'Download PDFs',
    description: 'A separate PDF for each selected report.',
  },
  {
    mode: 'combined',
    label: 'Combined PDF',
    action: 'Download combined PDF',
    description: 'One PDF containing the selected reports in the current sort order.',
  },
  {
    mode: 'zip',
    label: 'ZIP of individual PDFs',
    action: 'Download ZIP',
    description: 'One ZIP containing a separate PDF for each selected report.',
  },
  {
    mode: 'folder',
    label: 'PDFs to a folder',
    action: 'Save to folder',
    description: 'A separate PDF for each selected report, saved to your chosen folder.',
  },
  {
    mode: 'csv',
    label: 'CSV',
    action: 'Download CSV',
    description: 'A spreadsheet-friendly table of report details and measurement fields.',
  },
  {
    mode: 'json',
    label: 'JSON',
    action: 'Download JSON',
    description: 'Complete saved report records, including measurements and attachments.',
  },
] as const;
type ExportMode = (typeof EXPORT_OPTIONS)[number]['mode'];

interface ReportsPageProps {
  children?: ReactNode;
  preferences: ReportPreferences;
  reports: SavedReport[];
  projects: readonly ReportProject[];
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
  projects,
  onRemove,
  busy,
  ready,
  error,
  onNotice,
}: ReportsPageProps): ReactElement {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [project, setProject] = useState('');
  const [sort, setSort] = useState<ReportSort>('date-desc');
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [exportMode, setExportMode] = useState<ExportMode>('individual');
  const folderSupported = supportsReportFolder();
  const projectNames = reportProjectNames(reports, projects);
  const projectOptions = new Map<string, string>();
  for (const name of projectNames.values()) {
    if (name && !projectOptions.has(name.toLowerCase()))
      projectOptions.set(name.toLowerCase(), name);
  }
  const currentProject = projectOptions.has(project) ? project : '';
  const visibleReports = sortReports(
    reports.filter(
      (report) => !currentProject || projectNames.get(report.id)?.toLowerCase() === currentProject,
    ),
    sort,
  );
  const selectedReports = visibleReports.filter((report) => selected.has(report.id));
  const allSelected = visibleReports.length > 0 && selectedReports.length === visibleReports.length;
  const exportOption =
    EXPORT_OPTIONS.find((option) => option.mode === exportMode) ?? EXPORT_OPTIONS[0];
  const exportSelected = async (mode: ExportMode): Promise<void> => {
    if (exporting || selectedReports.length === 0) return;
    setExporting(true);
    setExportStatus('');
    let completed = 0;
    const progress = (count: number): void => {
      completed = count;
      setExportStatus(
        `${mode === 'folder' ? 'Saved' : 'Prepared'} ${count} of ${selectedReports.length} PDFs…`,
      );
    };
    try {
      if (mode === 'csv' || mode === 'json') {
        const csv = mode === 'csv';
        const content = csv
          ? '\uFEFF' + createReportCsv(selectedReports)
          : createReportJson(selectedReports);
        const type = csv ? 'text/csv;charset=utf-8' : 'application/json';
        downloadReportBlob(
          new Blob([content], { type }),
          `Pocketweb reports ${new Date().toISOString().slice(0, 10)}.${mode}`,
        );
        setExportStatus(`${mode.toUpperCase()} download requested.`);
      } else if (mode === 'combined' || mode === 'individual') {
        const download = mode === 'combined' ? downloadCombinedReportsPdf : downloadReportsPdf;
        download(selectedReports, preferences.logoDataUrl, preferences.showFooterLogo);
        setExportStatus(
          mode === 'combined'
            ? 'Combined PDF download requested.'
            : `${selectedReports.length} individual PDF download${selectedReports.length === 1 ? '' : 's'} requested. Your browser may ask you to allow multiple downloads.`,
        );
      } else {
        // Open the picker directly from the click, before any asynchronous work.
        const directory = mode === 'folder' ? await pickReportFolder() : null;
        const files = reportPdfFiles(
          selectedReports,
          preferences.logoDataUrl,
          preferences.showFooterLogo,
        );
        if (directory) {
          await saveReportFilesToFolder(files, directory, progress);
          setExportStatus(`Saved ${files.length} individual PDFs to the selected folder.`);
        } else {
          const zip = await createReportsZip(files, progress);
          downloadReportBlob(zip, `Pocketweb reports ${new Date().toISOString().slice(0, 10)}.zip`);
          setExportStatus(`ZIP download requested with ${files.length} individual PDFs.`);
        }
      }
    } catch (reason) {
      if (reason instanceof Error && reason.name === 'AbortError') {
        setExportStatus(
          mode === 'folder' && completed > 0
            ? `Folder export cancelled after saving ${completed} of ${selectedReports.length} PDFs.`
            : 'Export cancelled.',
        );
      } else {
        const message = reason instanceof Error ? reason.message : 'Please try again.';
        setExportStatus(
          mode === 'folder'
            ? `Saved ${completed} of ${selectedReports.length} PDFs before folder export failed. ${message}`
            : `Export failed. ${message}`,
        );
      }
    } finally {
      setExporting(false);
    }
  };
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
      <section className="report-library" aria-labelledby="saved-reports-title">
        <header>
          <div>
            <h2 id="saved-reports-title">Saved reports</h2>
            <p>{reports.length} stored on this device</p>
          </div>
          <div className="reports-controls">
            <SelectField
              className="reports-filter"
              label="Project"
              value={currentProject}
              onChange={(event) => {
                setProject(event.target.value);
                setSelected(new Set());
              }}
            >
              <option value="">All projects</option>
              {[...projectOptions]
                .sort(([, a], [, b]) => a.localeCompare(b))
                .map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
            </SelectField>
            <SelectField
              className="reports-filter"
              label="Sort by"
              value={sort}
              onChange={(event) => {
                if (isReportSort(event.target.value)) setSort(event.target.value);
              }}
            >
              {REPORT_SORT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
        </header>
        <div
          className="report-export-toolbar"
          aria-label="Export selected reports"
          aria-busy={exporting}
        >
          <div className="report-selection">
            <label>
              <Checkbox
                size="large"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = selectedReports.length > 0 && !allSelected;
                }}
                disabled={visibleReports.length === 0 || busy || exporting || !ready}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? new Set(visibleReports.map((report) => report.id))
                      : new Set(),
                  )
                }
              />
              Select all
            </label>
            <span>{selectedReports.length} selected</span>
          </div>
          <SelectField
            className="reports-filter report-export-format"
            label="Export format"
            value={exportMode}
            disabled={exporting}
            aria-describedby="report-export-hint"
            onChange={(event) => {
              const option = EXPORT_OPTIONS.find((option) => option.mode === event.target.value);
              if (option) {
                setExportMode(option.mode);
                setExportStatus('');
              }
            }}
          >
            {EXPORT_OPTIONS.map((option) => (
              <option
                key={option.mode}
                value={option.mode}
                disabled={option.mode === 'folder' && !folderSupported}
              >
                {option.label}
              </option>
            ))}
          </SelectField>
          <Button
            variant="primary"
            className="report-export-button"
            disabled={
              selectedReports.length === 0 ||
              busy ||
              exporting ||
              (exportMode === 'folder' && !folderSupported)
            }
            onClick={() => void exportSelected(exportMode)}
          >
            {exporting ? 'Exporting…' : exportOption.action}
          </Button>
          <p className="report-export-hint" id="report-export-hint">
            {exportOption.description}
          </p>
        </div>
        {!folderSupported && (
          <p className="report-export-status">
            Folder export requires desktop Chrome or Edge. You can download a ZIP in this browser.
          </p>
        )}
        {exportStatus && (
          <p className="report-export-status" role="status">
            {exportStatus}
          </p>
        )}
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
                <Checkbox
                  size="large"
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
                  {projectNames.get(report.id) && <small>{projectNames.get(report.id)}</small>}
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
