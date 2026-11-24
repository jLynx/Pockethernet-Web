import type { MeasurementSettings, TestId, ToolSettings, WorkflowMode } from './types';

export interface MeasurementPreset {
  id: string;
  name: string;
  mode: WorkflowMode;
  selected: TestId[];
  toolSettings: ToolSettings;
  measurementSettings: MeasurementSettings;
  pingTargets: string[];
}

export interface ReportProject {
  id: string;
  name: string;
  site: string;
  numberPattern: string;
  incrementCableId?: boolean;
}

export function loadNamedItems<T extends { id: string; name: string }>(
  key: string,
  isItem: (item: Record<string, unknown>) => boolean,
): T[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(data)) return [];
    const entries: unknown[] = data;
    return entries.filter(
      (item): item is T =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof item.id === 'string' &&
        'name' in item &&
        typeof item.name === 'string' &&
        isItem(item),
    );
  } catch {
    return [];
  }
}

export function formatJobReportNumber(pattern: string, number: number): string {
  return pattern.replace(/#+/g, (placeholder) => String(number).padStart(placeholder.length, '0'));
}
