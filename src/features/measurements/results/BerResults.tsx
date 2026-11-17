import { useDecimalSeparator } from '@/app/decimalPreference';
import { formatScalar } from '@/app/numberFormat';
import type { ReactElement } from 'react';
import type { BerDisplayResult } from '@/app/types';

export function BerResults({ result }: { result: BerDisplayResult | null }): ReactElement {
  const separator = useDecimalSeparator();
  return (
    <div className="ber-results">
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
          <strong>{result ? formatScalar(result.errorRate, separator) : '---'}</strong>
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
