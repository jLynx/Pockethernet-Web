import { useId, type ReactElement } from 'react';
import { TextField } from '@/shared/ui/UiPrimitives';
import { firmwareRequirement, firmwareSupports } from '@/protocol/firmwareFeatures';

const PRESETS = [
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
  onChange,
  firmwareVersion,
}: {
  value: string;
  onChange: (value: string) => void;
  firmwareVersion?: number;
}): ReactElement {
  const id = useId();
  const unavailable =
    firmwareVersion !== undefined && !firmwareSupports(firmwareVersion, 'dhcpVendorClass');
  return (
    <>
      <TextField
        label="DHCP vendor class (option 60)"
        value={value}
        list={id}
        placeholder="None"
        maxLength={64}
        disabled={unavailable}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={id}>
        {PRESETS.map(([label, preset]) => (
          <option key={preset} value={preset}>
            {label}
          </option>
        ))}
      </datalist>
      {unavailable && <p className="settings-hint">{firmwareRequirement('dhcpVendorClass')}</p>}
    </>
  );
}
