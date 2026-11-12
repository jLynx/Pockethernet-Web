import type { ReportDetails, ReportDraft, ReportPhoto, SavedReport } from './types';

export function incrementCableId(id: string): string | null {
  const match = /^(.*?)([0-9]+)$/.exec(id.trim());
  if (!match) return null;
  return `${match[1]}${(BigInt(match[2]) + 1n).toString().padStart(match[2].length, '0')}`;
}

export function matchingCableReports(
  reports: SavedReport[],
  details: ReportDetails,
): SavedReport[] {
  const normalized = (text: string | undefined): string => (text ?? '').trim().toLocaleLowerCase();
  if (!normalized(details.tag)) return [];
  return reports.filter(
    (report) =>
      normalized(report.details.tag) === normalized(details.tag) &&
      normalized(report.details.project) === normalized(details.project) &&
      normalized(report.details.address) === normalized(details.address),
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
): string | null {
  let next = incrementCableId(id);
  // Each collision consumes a distinct saved ID, bounding the search by the library size.
  for (let attempts = 0; next && attempts <= reports.length; attempts++) {
    if (!matchingCableReports(reports, { ...details, tag: next }).length) return next;
    next = incrementCableId(next);
  }
  return null;
}
