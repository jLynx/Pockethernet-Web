import type { ReactElement } from 'react';
import { Button, TextField } from '@/shared/ui/UiPrimitives';
import { firmwareRequirement, firmwareSupports } from '@/protocol/firmwareFeatures';

const PRESETS = [
  ['None', ''],
  ['Pockethernet', 'Pockethernet'],
  ['Cisco AP', 'Cisco AP c9120'],
  ['Aruba AP', 'ArubaAP'],
  ['Ubiquiti', 'ubnt'],
  ['Ruckus AP', 'Ruckus CPE'],
  ['Cisco phone', 'Cisco Systems, Inc. IP Phone CP-8841'],
  ['Polycom', 'Polycom-VVX411'],
  ['Yealink', 'yealink'],
  ['Snom', 'snomD785'],
  ['Mitel', 'ipphone.mitel.com'],
  ['Avaya', 'ccp.avaya.com'],
  ['Windows', 'MSFT 5.0'],
  ['Android', 'android-dhcp-14'],
] as const;

export function DhcpVendorClass({
  value,
  custom = false,
  onChange,
  firmwareVersion,
}: {
  value: string;
  custom?: boolean;
  onChange: (value: string, custom: boolean) => void;
  firmwareVersion?: number;
}): ReactElement {
  const unavailable =
    firmwareVersion !== undefined && !firmwareSupports(firmwareVersion, 'dhcpVendorClass');
  const customSelected = custom || !PRESETS.some(([, preset]) => preset === value);
  return (
    <fieldset className="dhcp-vendor-class" disabled={unavailable}>
      <legend>DHCP vendor class (option 60)</legend>
      <div className="tool-button-row dhcp-vendor-options">
        {PRESETS.map(([label, preset]) => {
          const selected = !customSelected && value === preset;
          return (
            <Button
              key={preset}
              variant={selected ? 'primary' : 'secondary'}
              aria-pressed={selected}
              title={preset || undefined}
              onClick={() => onChange(preset, false)}
            >
              {label}
            </Button>
          );
        })}
        <Button
          variant={customSelected ? 'primary' : 'secondary'}
          aria-pressed={customSelected}
          onClick={() => onChange(value, true)}
        >
          Custom
        </Button>
      </div>
      {customSelected && (
        <TextField
          label="Custom vendor class"
          value={value}
          maxLength={64}
          spellCheck={false}
          autoCapitalize="none"
          onChange={(event) => onChange(event.target.value, true)}
        />
      )}
      {unavailable && <p className="settings-hint">{firmwareRequirement('dhcpVendorClass')}</p>}
    </fieldset>
  );
}
