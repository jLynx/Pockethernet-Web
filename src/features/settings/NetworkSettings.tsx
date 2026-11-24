import type { ReactElement } from 'react';
import type { MeasurementSettings, StateSetter, TestId } from '@/app/types';
import { Checkbox, SelectField, TextField } from '@/shared/ui/UiPrimitives';
import { ToolControl } from '@/features/tools/ToolControls';
import { DiscoverySettings } from './DiscoverySettings';
import { DhcpVendorClass } from './DhcpVendorClass';

interface NetworkSettingsProps {
  section?:
    'all' | 'ipv4' | 'ipv6' | 'cdplldp' | 'cdp' | 'lldp' | 'network-discovery' | 'vlan' | 'ping';
  settings: MeasurementSettings;
  discoveryUnavailable?: boolean;
  firmwareVersion?: number;
  selected?: ReadonlySet<TestId>;
  onChange: StateSetter<MeasurementSettings>;
  pingTargets: string[];
  onPingTargetsChange: StateSetter<string[]>;
}

export function NetworkSettings({
  section = 'all',
  settings,
  discoveryUnavailable,
  firmwareVersion,
  selected = new Set<TestId>(),
  onChange,
  pingTargets,
  onPingTargetsChange,
}: NetworkSettingsProps): ReactElement {
  const show = (name: typeof section): boolean => section === 'all' || section === name;
  const showDiscovery = show('network-discovery') && !discoveryUnavailable;
  const ipv4 = settings.ipv4Settings;
  const staticFields = [
    ['ip', 'Static IP'],
    ['netmask', 'Subnet mask'],
    ['gateway', 'Gateway'],
    ['dns', 'DNS'],
  ] as const;
  return (
    <div className="settings-fields">
      {show('ipv4') && (
        <>
          <SelectField
            label="IPv4 mode"
            value={ipv4.mode}
            onChange={(event) => {
              const mode = event.target.value === 'static' ? 'static' : 'dhcp';
              onChange((current) => ({
                ...current,
                ipv4Settings: { ...current.ipv4Settings, mode },
              }));
            }}
          >
            <option value="dhcp">DHCPv4</option>
            <option value="static">Static</option>
          </SelectField>
          {ipv4.mode === 'dhcp' && (
            <DhcpVendorClass
              firmwareVersion={firmwareVersion}
              value={ipv4.vendorClass ?? ''}
              custom={ipv4.vendorClassCustom}
              onChange={(vendorClass, vendorClassCustom) =>
                onChange((current) => ({
                  ...current,
                  ipv4Settings: { ...current.ipv4Settings, vendorClass, vendorClassCustom },
                }))
              }
            />
          )}
          {ipv4.mode === 'static' && (
            <div className="settings-static-ip">
              {staticFields.map(([name, label]) => (
                <TextField
                  key={name}
                  label={label}
                  value={ipv4[name]}
                  placeholder="192.168.1.1"
                  maxLength={15}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      ipv4Settings: { ...current.ipv4Settings, [name]: event.target.value },
                    }))
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
      {show('ipv6') && (
        <>
          <SelectField
            label="IPv6 mode"
            value={settings.ipv6Mode}
            onChange={(event) => {
              const ipv6Mode =
                event.target.value === 'both'
                  ? 'both'
                  : event.target.value === 'dhcpv6'
                    ? 'dhcpv6'
                    : 'slaac';
              onChange((current) => ({ ...current, ipv6Mode }));
            }}
          >
            <option value="slaac">SLAAC</option>
            <option value="dhcpv6">DHCPv6</option>
            <option value="both">SLAAC + DHCPv6</option>
          </SelectField>
        </>
      )}
      {(show('cdp') || show('lldp')) && (
        <>
          <label className="neighbor-listen-option">
            <Checkbox
              checked={settings.cdpLldpFull === true}
              onChange={(event) => {
                const cdpLldpFull = event.target.checked;
                onChange((current) => ({ ...current, cdpLldpFull }));
              }}
            />
            Listen the full 70 seconds for CDP and LLDP
          </label>
          <p className="settings-hint">Off stops each selected test at its first announcement.</p>
        </>
      )}
      {showDiscovery && (
        <DiscoverySettings
          settings={settings}
          onChange={onChange}
          selected={selected}
          firmwareVersion={firmwareVersion}
        />
      )}
      {show('vlan') && (
        <>
          <ToolControl
            label="Outgoing VLAN tagging"
            name="tagging"
            value={settings.vlanSettings.tagging ? 'on' : 'off'}
            options={[
              ['off', 'Off'],
              ['on', 'On'],
            ]}
            onChange={(_, value) =>
              onChange((current) => ({
                ...current,
                vlanSettings: { ...current.vlanSettings, tagging: value === 'on' },
              }))
            }
          />
          <TextField
            label="Outgoing VLAN ID"
            value={settings.vlanSettings.id}
            disabled={!settings.vlanSettings.tagging}
            placeholder="1–4094"
            inputMode="numeric"
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                vlanSettings: {
                  ...current.vlanSettings,
                  id: event.target.value.replace(/\D/g, '').slice(0, 4),
                },
              }))
            }
          />
        </>
      )}
      {show('ping') && (
        <>
          {pingTargets.map((target, index) => (
            <TextField
              key={index}
              label={`Ping server ${index}`}
              value={target}
              maxLength={127}
              placeholder="IP address or domain (optional)"
              onChange={(event) =>
                onPingTargetsChange((current) =>
                  current.map((value, slot) => (slot === index ? event.target.value : value)),
                )
              }
            />
          ))}
        </>
      )}
    </div>
  );
}
