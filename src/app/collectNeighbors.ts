import {
  PACKET,
  parseCdpLldpPacket,
  type CdpLldpResult,
  type Packet,
} from '@/pockethernetProtocol';
import { DeviceTimeoutError, type PacketWaitOptions } from '@/device/packetInbox';
import type { PockethernetClient } from '@/device/usePockethernet';
import type { NeighborResult } from './types';

function parse(packet: Packet, protocol: 'CDP' | 'LLDP'): CdpLldpResult | undefined {
  try {
    const result = parseCdpLldpPacket(packet.payload);
    return result.protocol === protocol ? result : undefined;
  } catch {
    return undefined;
  }
}

export async function collectNeighbors(
  ble: PockethernetClient,
  protocol: 'CDP' | 'LLDP',
  full: boolean,
  options: PacketWaitOptions,
): Promise<NeighborResult> {
  const timeout = 70_000;
  if (!full) {
    try {
      const packet = await ble.waitFor(PACKET.ETH_FILTER_MATCH, timeout, {
        ...options,
        accept: (value) => Boolean(parse(value, protocol)),
      });
      const match = parse(packet, protocol);
      if (match) return match;
    } catch (error) {
      if (!(error instanceof DeviceTimeoutError)) throw error;
    }
  } else {
    const results = new Map<string, CdpLldpResult>();
    try {
      await ble.collectFor(PACKET.ETH_FILTER_MATCH, timeout, {
        ...options,
        accept: (value) => {
          const match = parse(value, protocol);
          if (match) results.set(`${match.source}/${match.fields['Port ID'] ?? ''}`, match);
          return false;
        },
      });
    } catch (error) {
      if (!options.signal?.aborted || !results.size) throw error;
    }
    const announcements = [...results.values()];
    if (announcements.length)
      return {
        ...announcements[0],
        summary:
          announcements.length === 1
            ? announcements[0].summary
            : `${announcements.length} ${protocol} neighbors`,
        announcements,
      };
  }
  return { status: 'not_OK', summary: `No ${protocol} announcement received`, fields: {} };
}
