import type { ReportDetails, ReportDraft, ReportPhoto, SavedReport } from './types';
import type { ReportProject } from './savedConfigurations';

function normalized(text: string | undefined): string {
  return (text ?? '').trim().toLowerCase();
}

function projectSiteKey(name: string | undefined, site: string): string {
  return JSON.stringify([normalized(name), normalized(site)]);
}

export function sameProjectSite(first: ReportDetails, second: ReportDetails): boolean {
  return (
    projectSiteKey(first.project, first.address) === projectSiteKey(second.project, second.address)
  );
}

export function reportProjectNames(
  reports: readonly SavedReport[],
  projects: readonly ReportProject[],
): Map<string, string> {
  const savedNames = new Map(projects.map(({ id, name }) => [id, name]));
  const linkedNames = new Map<string, string>();
  const namesBySite = new Map<string, string>();
  for (const report of reports) {
    const linked = report.job;
    if (linked && !linkedNames.has(linked.id))
      linkedNames.set(linked.id, savedNames.get(linked.id) ?? linked.name);
  }
  for (const report of reports) {
    if (report.job) {
      const key = projectSiteKey(report.job.name, report.details.address);
      namesBySite.set(key, linkedNames.get(report.job.id) ?? report.job.name);
    }
  }
  for (const { name, site } of projects) namesBySite.set(projectSiteKey(name, site), name);
  return new Map(
    reports.map((report) => {
      const { project, address } = report.details;
      const name = report.job
        ? (linkedNames.get(report.job.id) ?? report.job.name)
        : (namesBySite.get(projectSiteKey(project, address)) ?? project ?? '');
      return [report.id, name.trim()];
    }),
  );
}

export function incrementCableId(id: string): string | null {
  const match = /^(.*?)([0-9]+)$/.exec(id.trim());
  if (!match) return null;
  return `${match[1]}${(BigInt(match[2]) + 1n).toString().padStart(match[2].length, '0')}`;
}

export function matchingCableReports(
  reports: SavedReport[],
  details: ReportDetails,
  projectId?: string,
): SavedReport[] {
  if (!normalized(details.tag)) return [];
  return reports.filter(
    (report) =>
      normalized(report.details.tag) === normalized(details.tag) &&
      ((projectId !== undefined && report.job?.id === projectId) ||
        sameProjectSite(report.details, details)),
  );
}

export function createSavedReport(
  draft: ReportDraft,
  details: ReportDetails,
  photos: ReportPhoto[],
  id: string,
  requireCableId = true,
): SavedReport {
  if (requireCableId && !details.tag.trim())
    throw new Error('Enter a Cable ID / Tag before saving.');
  if (
    !Object.values(draft.results).some(Boolean) &&
    !Object.keys(draft.failures).length &&
    !draft.runError
  )
    throw new Error('Run a measurement before saving.');
  return structuredClone({
    ...draft,
    id,
    details: { ...details, tag: details.tag.trim() },
    photos,
  });
}

export function nextAvailableCableId(
  id: string,
  reports: SavedReport[],
  details: ReportDetails,
  projectId?: string,
): string | null {
  let next = incrementCableId(id);
  // Each collision consumes a distinct saved ID, bounding the search by the library size.
  for (let attempts = 0; next && attempts <= reports.length; attempts++) {
    if (!matchingCableReports(reports, { ...details, tag: next }, projectId).length) return next;
    next = incrementCableId(next);
  }
  return null;
}
