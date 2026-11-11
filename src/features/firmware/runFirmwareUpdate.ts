import type { PockethernetClient } from '@/device/usePockethernet';
import { DeviceRejectedError, DeviceTimeoutError } from '@/device/packetInbox';
import {
  PACKET,
  ESP_UPDATE_RESPONSE_TIMEOUT_MS,
  deviceInfoCommand,
  espUpdateCommand,
  espUpdateFailure,
  ethernetStopCommand,
  ipv4EthernetCommand,
  isBerLinkUp,
  parseDeviceInfo,
  parseEspUpdateStatus,
  validateOfficialFirmwareUrl,
  type DeviceInfo,
} from '@/pockethernetProtocol';
import type { FirmwareUpdateTarget } from './updateTarget';

export type UpdateStage =
  'uploading' | 'preparing' | 'link' | 'dhcp' | 'settling' | 'installing' | 'finishing';
export type UpdateOutcome = { phase: 'restart' | 'failed' | 'unknown'; message: string };

export function sameDevice(left: DeviceInfo, right: DeviceInfo): boolean {
  return (
    left.serial === right.serial &&
    left.mac === right.mac &&
    left.hardwareVersion === right.hardwareVersion
  );
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new Error('Pockethernet disconnected'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

/** The APK sequence, with early-notification capture and the measured stock DHCP settle. */
export async function runFirmwareUpdate(options: {
  client: PockethernetClient;
  device: DeviceInfo;
  target: FirmwareUpdateTarget;
  signal: AbortSignal;
  onStage: (stage: UpdateStage) => void;
  onCommandStarting: () => void;
}): Promise<UpdateOutcome> {
  const { client, device, target, signal, onStage, onCommandStarting } = options;
  const scope = new AbortController();
  const abort = (): void => scope.abort();
  if (signal.aborted) abort();
  signal.addEventListener('abort', abort, { once: true });
  const waitOptions = { signal: scope.signal };
  let attempted = false;
  let ethernetConfigured = false;
  let workerFinished = false;
  const progressState: { stage: UpdateStage } = { stage: 'preparing' };
  const progress = (next: UpdateStage): void => {
    progressState.stage = next;
    onStage(next);
  };
  try {
    if (!target.source || target.source === 'official')
      validateOfficialFirmwareUrl(target.downloadUrl, target.latestVersion);
    const command = espUpdateCommand(target.downloadUrl);
    progress('preparing');
    const info = parseDeviceInfo(
      (await client.request(deviceInfoCommand(), PACKET.DEVICE_INFO, 3500, waitOptions)).payload,
    );
    if (
      !sameDevice(device, info) ||
      info.espVersion !== device.espVersion ||
      info.stmVersion !== device.stmVersion
    )
      throw new Error('The connected device or its firmware changed. Check for updates again.');
    if ((!target.source || target.source === 'official') && info.espVersion >= target.latestVersion)
      throw new Error('The device is already running this version or a newer version.');

    let beginLink!: () => void;
    const configured = new Promise<void>((resolve) => {
      beginLink = resolve;
    });
    let beginDhcp!: () => void;
    const linked = new Promise<void>((resolve) => {
      beginDhcp = resolve;
    });
    // Both notifications can arrive before ETH_CONFIG's ACK, or DHCP before link-up.
    const link = client.waitFor(PACKET.PHY_LINKINFO, 10000, {
      ...waitOptions,
      rejectNack: false,
      startAfter: configured,
      accept: (packet) => packet.payload.length >= 12 && isBerLinkUp(packet.payload),
    });
    const dhcp = client.waitFor(PACKET.DHCPV4_ACK, 30000, {
      ...waitOptions,
      rejectNack: false,
      startAfter: linked,
    });
    void link.catch(() => undefined);
    void dhcp.catch(() => undefined);
    progress('link');
    ethernetConfigured = true;
    await client.request(ipv4EthernetCommand('dhcp'), PACKET.ACK, 5000, waitOptions);
    beginLink();
    await link;
    progress('dhcp');
    beginDhcp();
    await dhcp;
    progress('settling');
    // Stock forwards DHCP ACK before lwIP activates its address. Proven workaround: 10 s.
    await delay(10000, scope.signal);
    if (scope.signal.aborted) throw new Error('Pockethernet disconnected');
    onCommandStarting(); // Save recovery context BEFORE any part of the F401 write.
    attempted = true;
    progress('installing');
    const reply = await client.request(
      command,
      PACKET.ESP_UPDATE,
      ESP_UPDATE_RESPONSE_TIMEOUT_MS,
      waitOptions,
    );
    const status = parseEspUpdateStatus(reply);
    // 0 can mean an already-active worker, and 255 has no subsequent completion reply.
    if (status === 0 || status === 255 || ![1, 3, 10, 11, 12, 13, 14, 15, 16].includes(status))
      return { phase: 'unknown', message: espUpdateFailure(status) };
    workerFinished = true;
    if (status !== 10) return { phase: 'failed', message: espUpdateFailure(status) };
    return {
      phase: 'restart',
      message: `Firmware v${target.latestVersion} downloaded and verified. Restart Pockethernet to finish the update.`,
    };
  } catch (error) {
    if (attempted && error instanceof DeviceRejectedError) workerFinished = true;
    // Once a write starts, a transport failure cannot prove that the ESP worker stopped.
    // A protocol NACK is an explicit command rejection and can be handled as a failure.
    if (attempted && !(error instanceof DeviceRejectedError))
      return {
        phase: 'unknown',
        message:
          'Update result was not received. The device may still be downloading or installing.',
      };
    const message =
      error instanceof DeviceTimeoutError
        ? progressState.stage === 'link'
          ? 'No Ethernet link. Connect Pockethernet to an Ethernet switch.'
          : progressState.stage === 'dhcp'
            ? 'Could not obtain an IP address via DHCP.'
            : error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return { phase: 'failed', message };
  } finally {
    scope.abort();
    signal.removeEventListener('abort', abort);
    // Never tear down Ethernet while the OTA worker could still be running.
    if (ethernetConfigured && (!attempted || workerFinished) && !signal.aborted) {
      if (workerFinished) onStage('finishing');
      try {
        await client.request(ethernetStopCommand(), PACKET.ACK, 2000);
      } catch {
        /* OTA status remains authoritative even if the cleanup ACK is lost. */
      }
    }
  }
}
