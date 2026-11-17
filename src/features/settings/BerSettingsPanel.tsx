import type { ReactElement } from 'react';
import type { MeasurementSettings, StateSetter } from '@/app/types';
import { SelectField } from '@/shared/ui/UiPrimitives';

export function BerSettingsPanel({
  settings,
  onChange,
}: {
  settings: MeasurementSettings;
  onChange: StateSetter<MeasurementSettings>;
}): ReactElement {
  const ber = settings.berSettings;
  return (
    <div className="settings-fields">
      <SelectField
        label="Link speed"
        value={ber.speed}
        onChange={(event) => {
          const speed =
            event.target.value === '10' ? 10 : event.target.value === '100' ? 100 : 1000;
          onChange((current) => ({ ...current, berSettings: { ...current.berSettings, speed } }));
        }}
      >
        <option value="10">10 Mbps</option>
        <option value="100">100 Mbps</option>
        <option value="1000">1000 Mbps</option>
      </SelectField>
      <SelectField
        label="Packet size"
        value={ber.frameSize}
        onChange={(event) => {
          const frameSize =
            event.target.value === '64' ? 64 : event.target.value === '1500' ? 1500 : 'both';
          onChange((current) => ({
            ...current,
            berSettings: { ...current.berSettings, frameSize },
          }));
        }}
      >
        <option value="64">64 bytes</option>
        <option value="1500">1514 bytes</option>
        <option value="both">Both</option>
      </SelectField>
      <SelectField
        label="Payload"
        value={ber.payloadMode}
        onChange={(event) => {
          const payloadMode = event.target.value === '55' ? '55' : 'random';
          onChange((current) => ({
            ...current,
            berSettings: { ...current.berSettings, payloadMode },
          }));
        }}
      >
        <option value="random">Random</option>
        <option value="55">0x55</option>
      </SelectField>
      <SelectField
        label="Packets"
        value={ber.total}
        onChange={(event) => {
          const total = Number(event.target.value);
          onChange((current) => ({ ...current, berSettings: { ...current.berSettings, total } }));
        }}
      >
        <option value="100000">100K</option>
        <option value="1000000">1M</option>
        <option value="10000000">10M</option>
      </SelectField>
      <p className="settings-hint">
        Requires the loopback adapter. The manual specifies a maximum cable run of 50 m / 160 ft.
      </p>
    </div>
  );
}
