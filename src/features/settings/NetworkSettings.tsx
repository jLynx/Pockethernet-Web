import type { ReactElement } from 'react';
import type { Ipv4UiSettings, MeasurementSettings, StateSetter } from '@/app/types';
import { SelectField, TextField } from '@/shared/ui/UiPrimitives';
import { ToolControl } from '@/features/tools/ToolControls';

interface NetworkSettingsProps {
  section?: 'all' | 'ipv4' | 'ipv6' | 'cdplldp' | 'network-discovery' | 'vlan' | 'ping';
  settings: MeasurementSettings;
  discoveryUnavailable?: boolean;
  onChange: StateSetter<MeasurementSettings>;
  pingTargets: string[];
  onPingTargetsChange: StateSetter<string[]>;
}

export function NetworkSettings({
  section = 'all',
  settings,
  discoveryUnavailable,
  onChange,
  pingTargets,
  onPingTargetsChange,
}: NetworkSettingsProps): ReactElement {
  const show = (name: typeof section): boolean => section === 'all' || section === name;
  const showDiscovery = show('network-discovery') && !discoveryUnavailable;
  const ipv4 = settings.ipv4Settings;
  const staticFields: readonly [Exclude<keyof Ipv4UiSettings, 'mode'>, string][] = [
    ['ip', 'Static IP'],
    ['netmask', 'Subnet mask'],
    ['gateway', 'Gateway'],
    ['dns', 'DNS'],
  ];
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
            <TextField
              label="DHCP vendor class"
              value={ipv4.vendorClass ?? ''}
              placeholder="Optional · firmware V18+"
              maxLength={64}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  ipv4Settings: { ...current.ipv4Settings, vendorClass: event.target.value },
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
      {showDiscovery && (
        <SelectField
          label="Network Discovery mode"
          value={settings.discoveryMode ?? 'active'}
          onChange={(event) => {
            const discoveryMode = event.target.value === 'passive' ? 'passive' : 'active';
            onChange((current) => ({ ...current, discoveryMode }));
          }}
        >
          <option value="active">Scan the attached IPv4 subnet and listen</option>
          <option value="passive">Listen only</option>
        </SelectField>
      )}
      {(show('cdplldp') || showDiscovery) && (
        <>
          <SelectField
            label={showDiscovery ? 'Discovery observation time' : 'CDP / LLDP observation time'}
            value={settings.discoveryTimeout}
            onChange={(event) => {
              const discoveryTimeout =
                event.target.value === '10000'
                  ? 10000
                  : event.target.value === '60000'
                    ? 60000
                    : 30000;
              onChange((current) => ({ ...current, discoveryTimeout }));
            }}
          >
            <option value="10000">10 seconds</option>
            <option value="30000">30 seconds</option>
            <option value="60000">1 minute</option>
          </SelectField>
          {showDiscovery && (
            <p className="settings-hint">
              Active Discovery uses the configured IPv4 settings and listens only if an address is
              unavailable.
            </p>
          )}
        </>
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
