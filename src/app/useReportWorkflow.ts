import { useRef, useState } from 'react';
import type { ReportDraft, ReportPhoto, ReportDetails, StateSetter } from './types';
import type { ReportLibrary } from './useReports';
import {
  createSavedReport,
  incrementCableId,
  matchingCableReports,
  nextAvailableCableId,
} from './reportWorkflow';

interface WorkflowOptions {
  library: ReportLibrary;
  draft: ReportDraft | null;
  details: ReportDetails;
  setDetails: StateSetter<ReportDetails>;
  autoIncrement: boolean;
  onNext: () => void;
  onNotice: (message: string) => void;
}

function useReportWorkflowInternal(options: WorkflowOptions) {
  const { library, draft, details, setDetails, autoIncrement, onNext, onNotice } = options;
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [savedRun, setSavedRun] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const saved = !!draft && draft.createdAt === savedRun;
  const save = async (advance: boolean): Promise<void> => {
    if (!draft || locked.current || addingPhotos || !library.ready) return;
    if (advance && autoIncrement && incrementCableId(details.tag) === null) {
      onNotice('Auto increment needs a Cable ID ending in a number, for example CAB-001.');
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      let reports = library.reports;
      if (!saved) {
        const report = createSavedReport(draft, details, photos, crypto.randomUUID());
        const duplicates = matchingCableReports(reports, details);
        if (
          duplicates.length &&
          !window.confirm(
            `Cable ID ${details.tag.trim()} already has ${duplicates.length} saved report(s) in this project and site. Save this run as a retest and keep the earlier reports?`,
          )
        )
          return;
        if (!(await library.add(report))) {
          onNotice('Could not save the report. Your results and photos are still available.');
          return;
        }
        reports = [report, ...reports];
        setSavedRun(draft.createdAt);
      }
      if (advance) {
        const next = autoIncrement ? nextAvailableCableId(details.tag, reports, details) : null;
        setDetails((current) => ({
          ...current,
          tag: next ?? current.tag,
          comment: '',
          portId: '',
        }));
        setPhotos([]);
        onNext();
        onNotice(
          next ? `Report saved. Ready for ${next}.` : 'Report saved. Ready for the next cable.',
        );
      } else onNotice('Measurement report saved.');
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : 'Could not save this report.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const beforeMeasure = (): boolean => {
    if (busy || addingPhotos || library.busy) return false;
    if (
      draft &&
      !saved &&
      !window.confirm(
        'Replace the unsaved measurement with a new run? Save the report first to keep these results.',
      )
    )
      return false;
    return true;
  };
  return { photos, setPhotos, addingPhotos, setAddingPhotos, saved, busy, save, beforeMeasure };
}

export function useReportWorkflow(
  options: WorkflowOptions,
): ReturnType<typeof useReportWorkflowInternal> {
  return useReportWorkflowInternal(options);
}
