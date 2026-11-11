import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PockethernetClient } from '@/device/usePockethernet';
import { createFirmwareUpdater, type FirmwareUpdateState } from './firmwareUpdateController';

export interface FirmwareUpdaterActions {
  state: FirmwareUpdateState;
  blockedReason: string;
  check: () => Promise<void>;
  confirm: () => void;
  cancel: () => void;
  start: () => Promise<void>;
  verify: () => Promise<void>;
  openAdvanced: () => void;
  closeAdvanced: () => void;
  chooseUrl: (url: string, version: number) => void;
  chooseFile: (file: File, downloadOrigin: string) => Promise<void>;
}

export function useFirmwareUpdater(options: {
  client: PockethernetClient;
  blockedReason: string;
  onLockChange: (locked: boolean) => void;
}): FirmwareUpdaterActions {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  }, [options]);
  const [controller] = useState(() =>
    createFirmwareUpdater({
      getClient: () => latest.current.client,
      getBlockedReason: () => latest.current.blockedReason,
      onLockChange: options.onLockChange,
      storage: window.localStorage,
    }),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  useEffect(() => {
    if (options.client.status === 'disconnected') controller.disconnected();
  }, [controller, options.client.status]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    if (!['restart', 'unknown'].includes(state.phase) && state.pending)
      window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.phase, state.pending]);
  // Abort transport waits on unmount; the recovery marker survives independently.
  // A generation guards React StrictMode's development effect setup/cleanup cycle.
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    return () => {
      queueMicrotask(() => {
        if (generation.current === current) controller.dispose();
      });
    };
  }, [controller]);
  return {
    state,
    blockedReason: options.blockedReason,
    check: controller.check,
    confirm: controller.confirm,
    cancel: controller.cancel,
    start: controller.start,
    verify: controller.verify,
    openAdvanced: controller.openAdvanced,
    closeAdvanced: controller.closeAdvanced,
    chooseUrl: controller.chooseUrl,
    chooseFile: controller.chooseFile,
  };
}
