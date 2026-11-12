import type { MeasurementContext } from './runMeasurements';
import type { MeasurementSettings, MeasurementFailures, ReportDraft } from './types';
import { emptyResults } from './useMeasurementState';
import { runMeasurementsWithNotifications } from '@/features/notifications/measurementNotifications';

export async function runReportMeasurement(
  context: MeasurementContext & { discoveryTimeout: MeasurementSettings['discoveryTimeout'] },
  onDraft: (draft: ReportDraft) => void,
): Promise<void> {
  const createdAt = new Date().toISOString();
  const settings = structuredClone(context.toolSettings);
  const selected = new Set(context.selected);
  const pingTargets = [...context.pingTargets];
  const measurementSettings: MeasurementSettings = structuredClone({
    berSettings: context.berSettings,
    vlanSettings: context.vlanSettings,
    ipv4Settings: context.ipv4Settings,
    ipv6Mode: context.ipv6Mode,
    discoveryTimeout: context.discoveryTimeout,
  });
  let failures: MeasurementFailures = {};
  await runMeasurementsWithNotifications(
    {
      ...context,
      ...measurementSettings,
      toolSettings: settings,
      selected,
      pingTargets,
      setFailures: (update) => {
        failures = typeof update === 'function' ? update(failures) : update;
        context.setFailures?.(failures);
      },
    },
    (snapshot) =>
      onDraft(
        structuredClone({
          createdAt,
          completedAt: new Date().toISOString(),
          settings,
          measurementSettings,
          pingTargets,
          selectedTests: [...selected],
          results: { ...emptyResults(), ...snapshot.results },
          failures,
          runError: snapshot.error,
        }),
      ),
  );
}
