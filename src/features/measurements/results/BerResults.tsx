import type { ChangeEvent, ReactElement } from 'react';
import type { BerDisplayResult, BerSettings, StateSetter } from '@/app/types';
import { SelectField } from '@/shared/ui/UiPrimitives';

interface BerResultsProps {
  result: BerDisplayResult | null;
  settings: BerSettings;
  onSettingsChange: StateSetter<BerSettings>;
  disabled: boolean;
}

export function BerResults({
  result,
  settings,
  onSettingsChange,
  disabled,
}: BerResultsProps): ReactElement {
  const update = (event: ChangeEvent<HTMLSelectElement>): void => {
    const { name, value } = event.target;
    onSettingsChange((current) => {
      if (name === 'payloadMode')
        return { ...current, payloadMode: value === '55' ? '55' : 'random' };
      if (name === 'frameSize')
        return { ...current, frameSize: value === 'both' ? 'both' : value === '1500' ? 1500 : 64 };
      if (name === 'speed')
        return { ...current, speed: value === '10' ? 10 : value === '100' ? 100 : 1000 };
      if (name === 'total') return { ...current, total: Number(value) };
      return current;
    });
  };
  return (
    <div className="ber-results">
      <div className="ber-settings">
        <SelectField
          label="Speed"
          name="speed"
          value={settings.speed}
          onChange={update}
          disabled={disabled}
        >
          <option value="10">10 Mbps</option>
          <option value="100">100 Mbps</option>
          <option value="1000">1000 Mbps</option>
        </SelectField>
        <SelectField
          label="Packet size"
          name="frameSize"
          value={settings.frameSize}
          onChange={update}
          disabled={disabled}
        >
          <option value="64">64 bytes</option>
          <option value="1500">1514 bytes</option>
          <option value="both">Both</option>
        </SelectField>
        <SelectField
          label="Payload"
          name="payloadMode"
          value={settings.payloadMode}
          onChange={update}
          disabled={disabled}
        >
          <option value="random">Random</option>
          <option value="55">0x55</option>
        </SelectField>
        <SelectField
          label="Packets"
          name="total"
          value={settings.total}
          onChange={update}
          disabled={disabled}
        >
          <option value="100000">100K</option>
          <option value="1000000">1M</option>
          <option value="10000000">10M</option>
        </SelectField>
      </div>
      <div className="ber-table">
        <div>
          <span>Sent</span>
          <strong>{result?.sent.toLocaleString() ?? '0'}</strong>
        </div>
        <div>
          <span>Received</span>
          <strong>{result?.received.toLocaleString() ?? '0'}</strong>
        </div>
        <div>
          <span>Errors</span>
          <strong>{result?.errors.toLocaleString() ?? '0'}</strong>
        </div>
        <div>
          <span>Error rate</span>
          <strong>{result?.errorRate ?? '---'}</strong>
        </div>
      </div>
      {result && (
        <p className="ber-progress">
          {result.completedBatches < result.batchCount
            ? `Batch ${result.completedBatches} of ${result.batchCount}`
            : 'Measurement complete'}
        </p>
      )}
    </div>
  );
}
