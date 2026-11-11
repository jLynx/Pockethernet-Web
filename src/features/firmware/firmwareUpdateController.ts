import type { PockethernetClient } from '@/device/usePockethernet';
import type { FirmwareCheck } from '@/app/types';
import {
  PACKET,
  ESP_UPDATE_RESPONSE_TIMEOUT_MS,
  deviceInfoCommand,
  parseDeviceInfo,
  parseFirmwareVersionResponse,
  validateOfficialFirmwareUrl,
  espUpdateCommand,
  type DeviceInfo,
} from '@/pockethernetProtocol';
import { inspectOtaContainer, OTA_FILE_MAX_BYTES, type OtaFileInfo } from '@/protocol/otaContainer';
import type { FirmwareUpdateTarget } from './updateTarget';
import { otaDownloadOrigin, uploadOtaFile } from './uploadOtaFile';
import { runFirmwareUpdate, sameDevice, type UpdateStage } from './runFirmwareUpdate';
import {
  readPendingUpdate,
  UPDATE_RECOVERY_KEY,
  type PendingUpdate,
  type UpdateStorage,
} from './updateRecovery';

export type UpdatePhase =
  'idle' | 'confirm' | UpdateStage | 'restart' | 'unknown' | 'failed' | 'verified' | 'unconfirmed';
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
    message: recovered
      ? recovered.completed
        ? 'The update completed. Restart Pockethernet, reconnect and verify its firmware version.'
        : 'An update was started before this page closed. Its result is unknown.'
      : '',
  };
  const listeners = new Set<() => void>();
  let scope: AbortController | null = null;
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
      set({
        phase: 'idle',
        checking: true,
        check: null,
        message: '',
        advanced: false,
        selection: null,
      });
      try {
        const response = await (options.fetchLatest?.() ??
          fetch('/api/latest-version', {
            cache: 'no-store',
            signal: AbortSignal.timeout(15000),
          }));
        if (!response.ok) throw new Error(`Update server returned ${response.status}`);
        const result = parseFirmwareVersionResponse(await response.text(), device.espVersion);
        validateOfficialFirmwareUrl(result.downloadUrl, result.latestVersion);
        const current = options.getClient();
        if (
          current.status !== 'connected' ||
          !current.info ||
          !sameDevice(device, current.info) ||
          current.info.espVersion !== device.espVersion
        )
          return;
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
      const reason = unavailable();
      if (reason) {
        fail(reason);
        return;
      }
      const device = options.getClient().info;
      if (!device) return;
      confirmation = { device, target: state.check };
      set({ phase: 'confirm', message: '', selection: state.check });
    },
    cancel() {
      if (state.phase !== 'confirm') return;
      confirmation = null;
      set({ phase: 'idle', message: '', selection: null });
    },
    async start() {
      // Set the phase synchronously before the first await to reject duplicate clicks.
      if (state.phase !== 'confirm' || !confirmation || scope) return;
      const reason = unavailable();
      if (reason) {
        fail(reason);
        return;
      }
      const { device, file } = confirmation;
      let { target } = confirmation;
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
          onCommandStarting: () => {
            const pending = { device, target, startedAt: Date.now(), completed: false };
            options.storage.setItem(UPDATE_RECOVERY_KEY, JSON.stringify(pending));
            set({ pending });
          },
        });
        let pending = state.pending;
        if (outcome.phase === 'failed') {
          clearPending();
          pending = null;
        } else if (outcome.phase === 'restart' && pending) {
          pending = { ...pending, completed: true };
          // Keep the in-memory success even if browser storage becomes unavailable.
          try {
            options.storage.setItem(UPDATE_RECOVERY_KEY, JSON.stringify(pending));
          } catch {
            /* recovered as unknown */
          }
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
      if (!pending.completed && Date.now() < pending.startedAt + ESP_UPDATE_RESPONSE_TIMEOUT_MS) {
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
        if (!sameDevice(info, pending.device))
          throw new Error(
            'This is a different device. Reconnect the Pockethernet that was updated.',
          );
        if (info.stmVersion !== pending.device.stmVersion)
          throw new Error(
            'The STM firmware version changed unexpectedly. Update verification needs investigation.',
          );
        if (
          info.espVersion === pending.target.latestVersion &&
          pending.target.latestVersion === pending.device.espVersion
        ) {
          clearPending();
          set({
            phase: pending.completed ? 'verified' : 'unconfirmed',
            pending: null,
            check: null,
            message: pending.completed
              ? `ESP v${info.espVersion} confirmed after your restart. Both builds report this version, so build identity cannot be verified from the version number. STM remains v${info.stmVersion}.`
              : `ESP v${info.espVersion} is running after your restart. Both builds report this version and the OTA result was not received, so installation could not be confirmed.`,
          });
          return;
        }
        if (info.espVersion !== pending.target.latestVersion) {
          if (!pending.completed && info.espVersion === pending.device.espVersion) {
            clearPending();
            set({
              phase: 'failed',
              pending: null,
              check: null,
              message: `After restarting, Pockethernet is still running ESP v${info.espVersion}. The update was not applied. Check for updates to try again.`,
            });
            return;
          }
          set({
            message: `Pockethernet is running ESP v${info.espVersion}; expected v${pending.target.latestVersion}. Fully turn it off and on, then verify again.`,
          });
          return;
        }
        clearPending();
        set({
          phase: 'verified',
          pending: null,
          check: null,
          message: `Update verified: Pockethernet is running ESP v${info.espVersion}. STM firmware remains v${info.stmVersion}.`,
        });
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
