import type { PockethernetClient } from '@/device/usePockethernet';
import {
  PACKET,
  ESP_UPDATE_RESPONSE_TIMEOUT_MS,
  deviceInfoCommand,
  parseDeviceInfo,
  espUpdateCommand,
  type DeviceInfo,
} from '@/pockethernetProtocol';
import { inspectOtaContainer, OTA_FILE_MAX_BYTES, type OtaFileInfo } from '@/protocol/otaContainer';
import type { FirmwareCheck, FirmwareUpdateTarget, UsbUpdateTarget } from './updateTarget';
import { otaDownloadOrigin, uploadOtaFile } from './uploadOtaFile';
import { runFirmwareUpdate, sameDevice, type UpdateStage } from './runFirmwareUpdate';
import { checkOfficialFirmware, loadOfficialUsbManifest } from './officialFirmware';
import { runUsbFirmwareUpdate, UsbReleaseChangedError } from './runUsbFirmwareUpdate';
import { verifyInstalledFirmware } from './verifyFirmwareUpdate';
import {
  readPendingUpdate,
  UPDATE_RECOVERY_KEY,
  type PendingUpdate,
  type UpdateStorage,
} from './updateRecovery';

export type UpdatePhase =
  | 'idle'
  | 'confirm'
  | UpdateStage
  | 'usb'
  | 'restart'
  | 'unknown'
  | 'failed'
  | 'verified'
  | 'unconfirmed';
export interface FirmwareUpdateState {
  phase: UpdatePhase;
  checking: boolean;
  verifying: boolean;
  check: FirmwareCheck | null;
  message: string;
  pending: PendingUpdate | null;
  advanced: boolean;
  selecting: boolean;
  selection: FirmwareUpdateTarget | null;
  usbProgress?: number;
}
export function updateLocked(state: FirmwareUpdateState): boolean {
  return !['idle', 'confirm', 'failed', 'verified', 'unconfirmed'].includes(state.phase);
}
export function updateWorking(state: FirmwareUpdateState): boolean {
  return !['idle', 'confirm', 'restart', 'unknown', 'failed', 'verified', 'unconfirmed'].includes(
    state.phase,
  );
}

/** Transport-independent controller, shared by the React hook and regression tests. */
export function createFirmwareUpdater(options: {
  getClient: () => PockethernetClient;
  getBlockedReason: () => string;
  storage: UpdateStorage;
  onLockChange: (locked: boolean) => void;
  fetchLatest?: () => Promise<Response>;
  loadUsbManifest?: typeof loadOfficialUsbManifest;
  runUsb?: typeof runUsbFirmwareUpdate;
  uploadFile?: typeof uploadOtaFile;
}): {
  getState: () => FirmwareUpdateState;
  subscribe: (listener: () => void) => () => void;
  check: () => Promise<void>;
  confirm: () => void;
  cancel: () => void;
  start: () => Promise<void>;
  verify: () => Promise<void>;
  disconnected: () => void;
  dispose: () => void;
  openAdvanced: () => void;
  closeAdvanced: () => void;
  chooseUrl: (url: string, version: number) => void;
  chooseFile: (file: File, downloadOrigin: string) => Promise<void>;
} {
  const recovered = readPendingUpdate(options.storage);
  let state: FirmwareUpdateState = {
    phase: recovered ? (recovered.completed ? 'restart' : 'unknown') : 'idle',
    checking: false,
    verifying: false,
    check: null,
    pending: recovered,
    advanced: false,
    selecting: false,
    selection: recovered?.target ?? null,
    message:
      recovered?.target.method === 'usb'
        ? recovered.completed
          ? 'The USB transfer finished. Reconnect Pockethernet to verify its firmware.'
          : 'The USB update was interrupted. Verify the device or retry over USB.'
        : recovered
          ? recovered.completed
            ? 'The update completed. Restart Pockethernet, reconnect and verify its firmware version.'
            : 'An update was started before this page closed. Its result is unknown.'
          : '',
  };
  const listeners = new Set<() => void>();
  const loadUsbManifest = options.loadUsbManifest ?? loadOfficialUsbManifest;
  let scope: AbortController | null = null;
  let checkedDevice: DeviceInfo | null = null;
  let confirmation: {
    device: DeviceInfo;
    target: FirmwareUpdateTarget;
    file?: { file: File; info: OtaFileInfo; origin: string };
  } | null = null;
  let selectionGeneration = 0;
  let disposed = false;
  const set = (patch: Partial<FirmwareUpdateState>): void => {
    if (disposed) return;
    state = { ...state, ...patch };
    options.onLockChange(updateLocked(state));
    for (const listener of listeners) listener();
  };
  const clearPending = (): void => {
    try {
      options.storage.removeItem(UPDATE_RECOVERY_KEY);
    } catch {
      /* A stale marker is conservative: the next page requires version verification. */
    }
  };
  const unavailable = (): string => {
    const client = options.getClient();
    return client.status !== 'connected' || !client.info
      ? 'Connect Pockethernet first.'
      : options.getBlockedReason();
  };
  const fail = (message: string): void => set({ phase: 'failed', message });
  const savePending = (device: DeviceInfo, target: FirmwareUpdateTarget): void => {
    const pending = { device, target, startedAt: Date.now(), completed: false };
    options.storage.setItem(UPDATE_RECOVERY_KEY, JSON.stringify(pending));
    set({ pending });
  };
  const completePending = (pending: PendingUpdate): PendingUpdate => {
    const completed = { ...pending, completed: true };
    try {
      options.storage.setItem(UPDATE_RECOVERY_KEY, JSON.stringify(completed));
    } catch {
      /* Preserve the in-memory result; the stored marker recovers as unknown. */
    }
    return completed;
  };
  const sameFirmware = (left: DeviceInfo, right: DeviceInfo): boolean =>
    sameDevice(left, right) &&
    left.espVersion === right.espVersion &&
    left.stmVersion === right.stmVersion;
  const usbBlockedReason = (device: DeviceInfo, retry: boolean): string => {
    const client = options.getClient();
    if (client.status !== 'connected') return '';
    const matches = retry ? sameDevice : sameFirmware;
    if (!client.info || !matches(device, client.info))
      return 'The connected device or its firmware changed. Check for updates again.';
    return options.getBlockedReason();
  };
  const startUsb = async (
    device: DeviceInfo,
    target: UsbUpdateTarget,
    retry: boolean,
  ): Promise<void> => {
    const previousMessage = state.message;
    const reason = usbBlockedReason(device, retry);
    if (reason) {
      if (retry) set({ message: reason });
      else {
        set({ phase: 'failed', message: reason, check: null, selection: null });
        confirmation = null;
      }
      return;
    }
    confirmation = null;
    set({ phase: 'usb', selection: target, usbProgress: undefined, message: '' });
    try {
      const result = await (options.runUsb ?? runUsbFirmwareUpdate)({
        version: target.latestVersion,
        mode: retry ? 'backup' : 'fast',
        loadManifest: loadUsbManifest,
        onStage: (message) => set({ message }),
        onProgress: (fraction) => {
          const progress = Math.floor(Math.max(0, Math.min(1, fraction)) * 100);
          if (progress > (state.usbProgress ?? -1)) set({ usbProgress: progress });
        },
        onWriteStarting: () => {
          if (disposed) throw new Error('The firmware update page was closed.');
          const blocked = usbBlockedReason(device, retry);
          if (blocked) throw new Error(blocked);
          savePending(device, target);
        },
      });
      if (result === 'cancelled') {
        if (retry) set({ phase: 'unknown', message: previousMessage });
        else {
          confirmation = { device, target };
          set({ phase: 'confirm', message: 'No tester selected. Try again.' });
        }
      } else if (state.pending) {
        set({
          phase: 'restart',
          pending: completePending(state.pending),
          message: 'USB transfer complete. Reconnect Pockethernet to verify its firmware.',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'USB update failed.';
      if (state.pending) set({ phase: 'unknown', message });
      else {
        if (error instanceof UsbReleaseChangedError) set({ check: null, selection: null });
        fail(message);
      }
    }
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async check() {
      if (state.checking || state.selecting || updateLocked(state)) return;
      const client = options.getClient();
      if (!client.info || client.status !== 'connected') {
        fail('Connect Pockethernet first.');
        return;
      }
      const device = client.info;
      confirmation = null;
      checkedDevice = null;
      set({
        phase: 'idle',
        checking: true,
        check: null,
        message: '',
        advanced: false,
        selection: null,
      });
      try {
        const result = await checkOfficialFirmware(device, loadUsbManifest, options.fetchLatest);
        const current = options.getClient();
        if (current.status !== 'connected' || !current.info || !sameFirmware(device, current.info))
          return;
        checkedDevice = device;
        set({ check: result });
      } catch (error) {
        set({
          check: {
            error: error instanceof Error ? error.message : 'Could not reach the update server',
          },
        });
      } finally {
        set({ checking: false });
      }
    },
    confirm() {
      if (
        updateLocked(state) ||
        state.checking ||
        !state.check ||
        'error' in state.check ||
        !state.check.updateAvailable
      )
        return;
      const target = state.check;
      const device = checkedDevice;
      if (!device) return;
      const reason = target.method === 'usb' ? usbBlockedReason(device, false) : unavailable();
      if (reason) {
        set({ phase: 'failed', message: reason, check: null, selection: null });
        return;
      }
      confirmation = { device, target };
      set({ phase: 'confirm', message: '', selection: target });
    },
    cancel() {
      if (state.phase !== 'confirm') return;
      confirmation = null;
      set({ phase: 'idle', message: '', selection: null });
    },
    async start() {
      // Set the phase synchronously before the first await to reject duplicate clicks.
      if (scope || state.verifying) return;
      if (state.phase === 'unknown' && state.pending?.target.method === 'usb') {
        await startUsb(state.pending.device, state.pending.target, true);
        return;
      }
      if (state.phase !== 'confirm' || !confirmation) return;
      const { device, file } = confirmation;
      let { target } = confirmation;
      if (target.method === 'usb') {
        await startUsb(device, target, false);
        return;
      }
      const reason = unavailable();
      if (reason) {
        fail(reason);
        return;
      }
      confirmation = null;
      scope = new AbortController();
      set({ phase: 'preparing', message: '', pending: null });
      try {
        if (file) {
          set({ phase: 'uploading' });
          const url = await (options.uploadFile ?? uploadOtaFile)(
            file.file,
            file.info,
            file.origin,
            scope.signal,
          );
          target = { ...target, downloadUrl: url };
          espUpdateCommand(url);
          set({ selection: target });
        }
        const outcome = await runFirmwareUpdate({
          client: options.getClient(),
          device,
          target,
          signal: scope.signal,
          onStage: (phase) => set({ phase }),
          onCommandStarting: () => savePending(device, target),
        });
        let pending = state.pending;
        if (outcome.phase === 'failed') {
          clearPending();
          pending = null;
        } else if (outcome.phase === 'restart' && pending) {
          pending = completePending(pending);
        }
        set({ ...outcome, pending });
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Could not prepare the OTA file.');
      } finally {
        scope = null;
      }
    },
    async verify() {
      const pending = state.pending;
      if (!pending || state.verifying || !['restart', 'unknown'].includes(state.phase)) return;
      if (
        pending.target.method !== 'usb' &&
        !pending.completed &&
        Date.now() < pending.startedAt + ESP_UPDATE_RESPONSE_TIMEOUT_MS
      ) {
        set({
          message:
            'Keep power and Ethernet connected. Wait at least five minutes after starting the update before restarting and verifying.',
        });
        return;
      }
      set({ verifying: true });
      try {
        const client = options.getClient();
        if (client.status !== 'connected') await client.connect();
        const info = parseDeviceInfo(
          (await client.request(deviceInfoCommand(), PACKET.DEVICE_INFO, 3500)).payload,
        );
        const result = verifyInstalledFirmware(info, pending);
        if (result.phase === 'unknown') {
          set(result);
          return;
        }
        clearPending();
        set({ ...result, pending: null, check: null, selection: null });
      } catch (error) {
        set({
          message: error instanceof Error ? error.message : 'Could not verify the updated device',
        });
      } finally {
        set({ verifying: false });
      }
    },
    disconnected() {
      selectionGeneration++;
      scope?.abort();
      // Switching off the tester for USB intentionally drops Bluetooth.
      if (
        !state.advanced &&
        (state.selection?.method === 'usb' ||
          (state.check && 'method' in state.check && state.check.method === 'usb'))
      )
        return;
      checkedDevice = null;
      if (state.phase === 'confirm') {
        confirmation = null;
        set({ phase: 'idle', check: null, selection: null, selecting: false });
      } else if (!updateLocked(state)) set({ check: null, selection: null, selecting: false });
    },
    dispose() {
      selectionGeneration++;
      disposed = true;
      scope?.abort();
      listeners.clear();
    },
    openAdvanced() {
      if (updateLocked(state) || state.checking || state.selecting) return;
      confirmation = null;
      set({ phase: 'idle', advanced: true, selection: null, message: '' });
    },
    closeAdvanced() {
      if (updateLocked(state)) return;
      selectionGeneration++;
      confirmation = null;
      set({ phase: 'idle', advanced: false, selection: null, selecting: false, message: '' });
    },
    chooseUrl(url, version) {
      if (!state.advanced || updateLocked(state) || state.selecting) return;
      try {
        const reason = unavailable();
        if (reason) throw new Error(reason);
        espUpdateCommand(url.trim());
        if (!Number.isSafeInteger(version) || version < 1 || version > 0x7fffffff)
          throw new Error('Enter the ESP version this firmware will report after boot.');
        const device = options.getClient().info;
        if (!device) return;
        const target: FirmwareUpdateTarget = {
          source: 'url',
          label: url.trim(),
          latestVersion: version,
          downloadUrl: url.trim(),
          updateAvailable: true,
          message: '',
        };
        confirmation = { device, target };
        set({ phase: 'confirm', selection: target, message: '' });
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Invalid OTA URL.');
      }
    },
    async chooseFile(file, downloadOrigin) {
      if (!state.advanced || updateLocked(state) || state.selecting) return;
      const generation = ++selectionGeneration;
      confirmation = null;
      set({ selecting: true, phase: 'idle', selection: null, message: '' });
      try {
        const reason = unavailable();
        if (reason) throw new Error(reason);
        const device = options.getClient().info;
        if (!device) return;
        const origin = otaDownloadOrigin(downloadOrigin);
        if (file.size > OTA_FILE_MAX_BYTES) throw new Error('OTA files cannot exceed 4 MiB.');
        const info = await inspectOtaContainer(await file.arrayBuffer());
        if (generation !== selectionGeneration || disposed) return;
        const current = options.getClient();
        if (current.status !== 'connected' || !current.info || !sameDevice(device, current.info))
          throw new Error('The connected device changed. Choose the OTA file again.');
        const target: FirmwareUpdateTarget = {
          source: 'file',
          label: file.name,
          sha256: info.sha256,
          bytes: info.bytes,
          latestVersion: info.version,
          downloadUrl: '',
          updateAvailable: true,
          message: '',
        };
        confirmation = { device, target, file: { file, info, origin } };
        set({ phase: 'confirm', selection: target, message: '' });
      } catch (error) {
        if (generation === selectionGeneration)
          fail(error instanceof Error ? error.message : 'Could not read the OTA file.');
      } finally {
        if (generation === selectionGeneration) set({ selecting: false });
      }
    },
  };
}
