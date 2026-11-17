import type { WorkflowMode } from './types';

export function loadWorkflowMode(): WorkflowMode {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('pockethernet.workflowMode') ?? 'null');
    if (saved === 'single' || saved === 'batch') return saved;
    // Preserve the batch workflow for users already using its persisted test selection.
    return localStorage.getItem('pockethernet.selectedTests') === null ? 'single' : 'batch';
  } catch {
    return 'single';
  }
}

export function configurationKey(prefix: string, setting: string): string {
  const key = `${prefix}${setting}`;
  try {
    return localStorage.getItem(key) === null ? `pockethernet.${setting}` : key;
  } catch {
    return key;
  }
}
