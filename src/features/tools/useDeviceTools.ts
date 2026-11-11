import { useRef, useState } from 'react';
import type { PockethernetClient } from '@/device/usePockethernet';
import type { BlinkerSettings, TonerSettings, WifiSettings } from '@/app/types';
import { errorMessage } from '@/app/format';
import {
  PACKET,
  blinkerCommand,
  tonerCommand,
  tonerStopCommand,
  wifiBridgeCommand,
  wifiBridgeEthernetCommand,
} from '@/pockethernetProtocol';

/** Keep tool writes mutually exclusive, and expose pending writes to OTA's preflight. */
export function useDeviceTools(options: {
  client: PockethernetClient;
  running: boolean;
  firmwareLocked: boolean;
  onNotice: (message: string) => void;
}): {
  busy: boolean;
  applyBlinker: (settings: BlinkerSettings, tonerActive: boolean) => Promise<boolean>;
  applyToner: (settings: TonerSettings, blinkerActive: boolean) => Promise<boolean>;
  applyWifi: (settings: WifiSettings) => Promise<boolean>;
} {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const { client, running, firmwareLocked, onNotice } = options;
  const run = async (label: string, action: () => Promise<void>): Promise<boolean> => {
    if (firmwareLocked) return false;
    if (client.status !== 'connected' || running || pending.current) {
      onNotice(
        client.status !== 'connected'
          ? 'Connect Pockethernet first.'
          : running
            ? 'Main measurements running'
            : 'Wait for the current device command to finish.',
      );
      return false;
    }
    pending.current = true;
    setBusy(true);
    try {
      await action();
      return true;
    } catch (error) {
      onNotice(`${label} failed: ${errorMessage(error)}`);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    busy,
    applyBlinker(settings, tonerActive) {
      if (tonerActive) {
        onNotice('Disable toner first');
        return Promise.resolve(false);
      }
      return run('Blinker', async () => {
        await client.request(
          blinkerCommand(settings.speed, settings.duplex, settings.mdi, settings.link),
          PACKET.ACK,
          5000,
        );
      });
    },
    applyToner(settings, blinkerActive) {
      if (blinkerActive) {
        onNotice('Disable Blinker function first');
        return Promise.resolve(false);
      }
      return run('Toner', async () => {
        await client.request(
          settings.power === 'on'
            ? tonerCommand(settings.pair, settings.shield, settings.tone, settings.volume)
            : tonerStopCommand(),
          PACKET.ACK,
          1000,
        );
      });
    },
    applyWifi(settings) {
      return run('WiFi bridge', async () => {
        if (settings.enabled === 'on') {
          await client.request(wifiBridgeEthernetCommand(), PACKET.ACK, 5000);
          await client.request(
            wifiBridgeCommand(true, settings.name, settings.password),
            PACKET.ACK,
            5000,
          );
        } else {
          await client.request(wifiBridgeCommand(false), PACKET.ACK, 5000);
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
        }
      });
    },
  };
}
