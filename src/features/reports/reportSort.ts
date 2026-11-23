import type { SavedReport } from '@/app/types';

export const REPORT_SORT_OPTIONS = [
  ['date-desc', 'Date/Time: newest first'],
  ['date-asc', 'Date/Time: oldest first'],
  ['tag-asc', 'Cable ID/Tag: ascending'],
  ['tag-desc', 'Cable ID/Tag: descending'],
] as const;

export type ReportSort = (typeof REPORT_SORT_OPTIONS)[number][0];

export function isReportSort(value: string): value is ReportSort {
  return REPORT_SORT_OPTIONS.some(([option]) => option === value);
}

const tags = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function sortReports(reports: readonly SavedReport[], order: ReportSort): SavedReport[] {
  return [...reports].sort((a, b) => {
    if (order === 'date-asc' || order === 'date-desc') {
      const difference = Date.parse(a.createdAt) - Date.parse(b.createdAt);
      return order === 'date-asc' ? difference : -difference;
    }
    const left = a.details.tag.trim();
    const right = b.details.tag.trim();
    // Untagged reports stay last in either direction.
    if (!left || !right) return Number(!left) - Number(!right);
    const difference = tags.compare(left, right);
    return order === 'tag-asc' ? difference : -difference;
  });
}
