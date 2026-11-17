import { useCallback, useEffect, useRef, useState } from 'react';
import type { SavedReport } from './types';
import { loadReports } from './storage';
import { deleteReportDatabase, readReportDatabase, writeReportDatabase } from './reportDatabase';

export interface ReportLibrary {
  reports: SavedReport[];
  ready: boolean;
  busy: boolean;
  error: string;
  add: (report: SavedReport) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export function useReports(): ReportLibrary {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  useEffect(() => {
    let active = true;
    void readReportDatabase()
      .then((saved) => {
        if (active) {
          setReports(saved);
          setReady(true);
          if (localStorage.getItem('pockethernet.reports') !== null)
            setError(
              'Some legacy reports could not be imported. The original data and a recovery copy have been retained.',
            );
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setReports(loadReports());
          setError(reason instanceof Error ? reason.message : 'Could not open report storage.');
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const mutate = useCallback(
    async (
      action: () => Promise<void>,
      update: (reports: SavedReport[]) => SavedReport[],
    ): Promise<boolean> => {
      if (locked.current || !ready) return false;
      locked.current = true;
      setBusy(true);
      try {
        await action();
        setReports(update);
        setError('');
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not save changes to reports.');
        return false;
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [ready],
  );
  return {
    reports,
    ready,
    busy,
    error,
    add: (report) =>
      mutate(
        () => writeReportDatabase(report),
        (current) => [report, ...current],
      ),
    remove: (id) =>
      mutate(
        () => deleteReportDatabase(id),
        (current) => current.filter((report) => report.id !== id),
      ),
  };
}
