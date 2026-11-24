import { useId, useState, type ReactElement } from 'react';
import { FiMinus, FiPlus } from 'react-icons/fi';
import { distanceForUnits, distanceUnitLabel, lastTdrLength } from '@/app/format';
import { formatDecimal } from '@/app/numberFormat';
import type { ReportResults, ToolSettings } from '@/app/types';
import { Button } from '@/shared/ui/UiPrimitives';

const MIN_NVP = 0.1;
const MAX_NVP = 100;

interface NvpCalibrationProps {
  settings: Pick<ToolSettings, 'nvp' | 'units' | 'decimalSeparator'>;
  lastTdr?: ReportResults['tdr'];
  onChange: (value: string) => void;
}

export function NvpCalibration({ settings, lastTdr, onChange }: NvpCalibrationProps): ReactElement {
  const hintId = useId();
  const [editing, setEditing] = useState<string | null>(null);
  const displayed = editing ?? settings.nvp.replace('.', settings.decimalSeparator ?? '.');
  const parsed = Number(displayed.replace(',', '.'));
  const valid = parsed >= MIN_NVP && parsed <= MAX_NVP;
  const nvp = valid ? parsed : Number(settings.nvp) || 71;
  const length = lastTdrLength(lastTdr, nvp);
  const step = (tenths: number): void => {
    const next = (Math.round(nvp * 10) + tenths) / 10;
    onChange(String(Math.min(MAX_NVP, Math.max(MIN_NVP, next))));
    setEditing(null);
  };
  return (
    <fieldset className="nvp-calibration">
      <legend>NVP calibration</legend>
      <div className="nvp-stepper">
        <Button aria-label="Decrease NVP" disabled={nvp <= MIN_NVP} onClick={() => step(-1)}>
          <FiMinus aria-hidden="true" />
        </Button>
        <div className="nvp-value">
          <input
            aria-label="NVP percentage"
            aria-describedby={hintId}
            aria-invalid={editing !== null && !valid}
            inputMode="decimal"
            value={displayed}
            onChange={(event) => {
              const value = event.target.value;
              if (/^\d{0,3}(?:[.,]\d?)?$/.test(value)) setEditing(value);
            }}
            onBlur={() => {
              if (editing !== null && valid) onChange(String(parsed));
              setEditing(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <span aria-hidden="true">%</span>
        </div>
        <Button aria-label="Increase NVP" disabled={nvp >= MAX_NVP} onClick={() => step(1)}>
          <FiPlus aria-hidden="true" />
        </Button>
      </div>
      <div className="nvp-preview">
        <span>Last TDR at this NVP</span>
        <output>
          {length !== undefined
            ? `${formatDecimal(distanceForUnits(length, settings.units), 1, settings.decimalSeparator)} ${distanceUnitLabel(settings.units)}`
            : lastTdr
              ? 'No cable end found'
              : 'No TDR result yet'}
        </output>
      </div>
      <p className="settings-hint" id={hintId}>
        Measure a known-length cable with its far end open. Adjust NVP until the last TDR matches
        the cable length.
      </p>
    </fieldset>
  );
}
