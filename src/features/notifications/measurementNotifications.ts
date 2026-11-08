import type { Dispatch, SetStateAction } from 'react';
import { tdrSummary } from '@/app/format';
import { runMeasurements, type MeasurementContext } from '@/app/runMeasurements';
import type { ReportResults, ToolSettings } from '@/app/types';
import {
  loadNotificationPreferences,
  notificationsSupported,
  showResultNotification,
} from './notifications';

export interface RunSnapshot {
  results: Partial<ReportResults>;
  error: string;
}

/** Capture only results produced by this run, including partial runs and BER batches. */
export function captureRun(context: MeasurementContext, snapshot: RunSnapshot): MeasurementContext {
  const capture =
    <Key extends keyof ReportResults>(
      key: Key,
      setter: Dispatch<SetStateAction<ReportResults[Key]>>,
    ): Dispatch<SetStateAction<ReportResults[Key]>> =>
    (update) => {
      const result = typeof update === 'function' ? update(snapshot.results[key] ?? null) : update;
      snapshot.results[key] = result;
      setter(result);
    };
  return {
    ...context,
    setNotice: (update) => {
      const notice = typeof update === 'function' ? update(snapshot.error) : update;
      snapshot.error = notice;
      context.setNotice(notice);
    },
    setWiremap: capture('wiremap', context.setWiremap),
    setTdr: capture('tdr', context.setTdr),
    setTdrGraph: capture('tdrGraph', context.setTdrGraph),
    setPoe: capture('poe', context.setPoe),
    setLink: capture('link', context.setLink),
    setCdplldp: capture('cdplldp', context.setCdplldp),
    setVlan: capture('vlan', context.setVlan),
    setTraffic: capture('traffic', context.setTraffic),
    setIpv4: capture('ipv4', context.setIpv4),
    setIpv6: capture('ipv6', context.setIpv6),
    setPing: capture('ping', context.setPing),
    setExtip: capture('extip', context.setExtip),
    setBer: capture('ber', context.setBer),
  };
}

export function notificationSummary(snapshot: RunSnapshot, settings: ToolSettings): string {
  const results = snapshot.results;
  const lines: string[] = snapshot.error ? [snapshot.error] : [];
  const add = (label: string, result: { summary: string } | null | undefined): void => {
    if (result) lines.push(`${label}: ${result.summary}`);
  };
  if (results.wiremap) {
    add('Wiremap', results.wiremap);
    const pins = Array.from({ length: 8 }, (_, index) => index + 1);
    const faults = pins.flatMap((pin) => {
      const destination = results.wiremap?.connections[pin];
      const short = results.wiremap?.shorts[pin];
      if (short && short > 0 && short < 10) return [`${pin} short ${short === 9 ? 'S' : short}`];
      if (destination === 255) return [`${pin} unknown`];
      if (!destination) return [`${pin} open`];
      return destination === pin ? [] : [`${pin}→${destination === 9 ? 'S' : destination}`];
    });
    if (faults.length) lines.push(faults.join(', '));
    if (results.wiremap.id > 0) lines.push(`Adapter ID: ${results.wiremap.id}`);
  }
  add('Link', results.link);
  add('PoE', results.poe);
  if (results.tdr) lines.push(`TDR: ${tdrSummary(results.tdr, settings.units)}`);
  if (results.tdrGraph) lines.push('TDR graph: traces ready');
  add('CDP/LLDP', results.cdplldp);
  add('VLAN', results.vlan);
  add('Traffic', results.traffic);
  add('IPv4', results.ipv4);
  add('IPv6', results.ipv6);
  add('Ping', results.ping);
  add('External IP', results.extip);
  if (results.ber) {
    const { completedBatches, batchCount, summary } = results.ber;
    lines.push(
      `Error rate: ${summary}${completedBatches < batchCount ? ` (${completedBatches}/${batchCount} batches)` : ''}`,
    );
  }
  return lines.join('\n') || 'Measurement run finished.';
}

export async function runMeasurementsWithNotifications(context: MeasurementContext): Promise<void> {
  const preferences = loadNotificationPreferences();
  const snapshot: RunSnapshot = { results: {}, error: '' };
  await runMeasurements(captureRun(context, snapshot));
  if (
    !preferences.enabled ||
    !loadNotificationPreferences().enabled ||
    !notificationsSupported() ||
    Notification.permission !== 'granted'
  )
    return;
  try {
    let image: string | undefined;
    if (preferences.images && snapshot.results.wiremap) {
      try {
        const { wiremapNotificationImage } = await import('./wiremapImage');
        image = wiremapNotificationImage(snapshot.results.wiremap, context.toolSettings.tia);
      } catch {
        // Always deliver the text summary if optional image generation fails.
      }
    }
    await showResultNotification(
      snapshot.error ? 'Pocketweb · Measurement interrupted' : 'Pocketweb · Results ready',
      notificationSummary(snapshot, context.toolSettings),
      image,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send notification.';
    context.setNotice(
      [snapshot.error, `Notification failed: ${message}`].filter(Boolean).join(' · '),
    );
  }
}
