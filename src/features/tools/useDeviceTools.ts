import { useEffect, useRef, useState } from 'react';
import type { PockethernetClient } from '@/device/usePockethernet';
import type { BlinkerSettings, TonerSettings, WifiSettings } from '@/app/types';
import { errorMessage } from '@/app/format';
import { firmwareRequirement, firmwareSupports } from '@/protocol/firmwareFeatures';
import {
  PACKET,
  blinkerCommand,
  ethernetStopCommand,
  readNegotiatedLinkSpeed,
  tonerCommand,
  tonerMelodyCommand,
  tonerStopCommand,
  wifiBridgeCommand,
  wifiBridgeEthernetCommand,
} from '@/pockethernetProtocol';

/** Keep tool writes mutually exclusive, and expose pending writes to OTA's preflight. */
export function useDeviceTools(options: {
  client: PockethernetClient;
  running: boolean;
  firmwareLocked: boolean;
  wifiEnabled?: boolean;
  otherToolActive?: boolean;
  onNotice: (message: string) => void;
}): {
  busy: boolean;
  bridgeSpeed: 0 | 10 | 100 | 1000 | null;
  applyBlinker: (settings: BlinkerSettings, tonerActive: boolean) => Promise<boolean>;
  applyToner: (settings: TonerSettings, blinkerActive: boolean) => Promise<boolean>;
  applyWifi: (settings: WifiSettings) => Promise<boolean>;
} {
  const [busy, setBusy] = useState(false);
  const [bridgeLink, setBridgeLink] = useState<{
    info: PockethernetClient['info'];
    speed: 0 | 10 | 100 | 1000;
  } | null>(null);
  const pending = useRef(false);
  const { client, running, firmwareLocked, onNotice } = options;
  const { request, status, info } = client;
  const { wifiEnabled, otherToolActive } = options;
  useEffect(() => {
    if (!wifiEnabled || status !== 'connected' || !info || running || busy || firmwareLocked)
      return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async (): Promise<void> => {
      if (!pending.current) {
        try {
          const reply = await request(
            { type: PACKET.PHY_QUERY, payload: new Uint8Array() },
            PACKET.PHY_QUERY,
            1500,
            { signal: controller.signal, rejectNack: false },
          );
          if (!controller.signal.aborted)
            setBridgeLink({ info, speed: readNegotiatedLinkSpeed(reply.payload) });
        } catch {
          if (!controller.signal.aborted) setBridgeLink(null);
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), 3000);
    };
    timer = setTimeout(() => void refresh(), 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [wifiEnabled, status, info, running, busy, firmwareLocked, request]);
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
    bridgeSpeed:
      wifiEnabled && status === 'connected' && bridgeLink?.info === info ? bridgeLink.speed : null,
    applyBlinker(settings, tonerActive) {
      if (wifiEnabled) {
        onNotice('Turn off the WiFi bridge first.');
        return Promise.resolve(false);
      }
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
      if (wifiEnabled) {
        onNotice('Turn off the WiFi bridge first.');
        return Promise.resolve(false);
      }
      if (blinkerActive) {
        onNotice('Disable Blinker function first');
        return Promise.resolve(false);
      }
      return run('Toner', async () => {
        const { tone } = settings;
        const melody = tone === 'melody';
        const pairs = settings.pairMask ?? settings.pair;
        if (settings.power === 'on' && melody && !firmwareSupports(info?.espVersion, 'tonerMelody'))
          throw new Error(firmwareRequirement('tonerMelody'));
        if (settings.power === 'on' && pairs === 0 && settings.shield === 'off')
          throw new Error('Select a pair or enable the shield tone.');
        const command =
          settings.power === 'off'
            ? tonerStopCommand(melody ? 'melody' : 'tone')
            : melody
              ? tonerMelodyCommand(settings.melody, pairs, settings.shield, settings.volume)
              : tonerCommand(pairs, settings.shield, tone, settings.volume);
        await client.request(command, PACKET.ACK, melody ? 2000 : 1000);
      });
    },
    applyWifi(settings) {
      return run('WiFi bridge', async () => {
        if (settings.enabled === 'on') {
          if (otherToolActive)
            throw new Error('Turn off the tone generator and port blinker first.');
          const passwordLength = new TextEncoder().encode(settings.password).length;
          if (settings.password === 'Pockethernet' || passwordLength < 8 || passwordLength > 63)
            throw new Error('Choose your own WiFi password of 8–63 UTF-8 bytes.');
          if (!settings.name.trim()) throw new Error('Enter a WiFi name.');
          const command = wifiBridgeCommand(
            true,
            settings.name,
            settings.password,
            settings.channel,
          );
          setBridgeLink(null);
          let wifiConfigSent = false;
          try {
            await client.request(wifiBridgeEthernetCommand(), PACKET.ACK, 5000);
            wifiConfigSent = true;
            await client.request(command, PACKET.ACK, 5000);
          } catch (error) {
            if (wifiConfigSent) {
              await client
                .request(wifiBridgeCommand(false), PACKET.ACK, 3000)
                .catch(() => undefined);
            }
            await client.request(ethernetStopCommand(), PACKET.ACK, 3000).catch(() => undefined);
            throw error;
          }
        } else {
          await client.request(wifiBridgeCommand(false), PACKET.ACK, 5000);
          setBridgeLink(null);
          try {
            await client.request(ethernetStopCommand(), PACKET.ACK, 3000);
          } catch {
            onNotice('WiFi stopped. Pockethernet did not confirm Ethernet shutdown.');
          }
        }
      });
    },
  };
}
