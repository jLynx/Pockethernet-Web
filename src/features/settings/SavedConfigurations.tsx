import { useState, type ReactElement } from 'react';
import { restoreSelection } from '@/app/testSelection';
import { normalizeMeasurementSettings } from '@/app/measurementSettings';
import type { MeasurementPreset } from '@/app/savedConfigurations';
import type { useAppSettings } from '@/app/useAppSettings';
import { ToolPanel } from '@/features/tools/ToolControls';
import { Button, SelectField, TextField } from '@/shared/ui/UiPrimitives';

type SettingsProps = {
  app: ReturnType<typeof useAppSettings>;
  disabled: boolean;
  onNotice: (message: string) => void;
};

export function PresetSettings({ app, disabled, onNotice }: SettingsProps): ReactElement {
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const presets = app.presets.filter((preset) => preset.mode === app.workflowMode);
  const selected = presets.find((item) => item.id === selectedId);

  const writePreset = (existing?: MeasurementPreset, renameOnly = false): void => {
    const label = name.trim();
    if (
      !label ||
      presets.some(
        (item) =>
          item.id !== existing?.id && item.name.toLocaleLowerCase() === label.toLocaleLowerCase(),
      )
    ) {
      onNotice(label ? 'A preset with that name already exists.' : 'Enter a preset name.');
      return;
    }
    const preset: MeasurementPreset =
      renameOnly && existing
        ? { ...existing, name: label }
        : structuredClone({
            id: existing?.id ?? crypto.randomUUID(),
            name: label,
            mode: app.workflowMode,
            selected: [...app.selected],
            toolSettings: app.toolSettings,
            measurementSettings: app.measurementSettings,
            pingTargets: app.pingTargets,
          });
    app.setPresets((current) =>
      existing
        ? current.map((item) => (item.id === existing.id ? preset : item))
        : [...current, preset],
    );
    setSelectedId(preset.id);
    setName(preset.name);
    onNotice(`Preset “${preset.name}” saved.`);
  };

  return (
    <ToolPanel title="Test presets" disabled={disabled}>
      <div className="settings-fields">
        <SelectField
          label="Test preset"
          value={selected?.id ?? ''}
          onChange={(event) => {
            const item = presets.find((preset) => preset.id === event.target.value);
            setSelectedId(item?.id ?? '');
            setName(item?.name ?? '');
          }}
        >
          <option value="">New preset</option>
          {presets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Preset name"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="batch-save-actions">
          {selected ? (
            <>
              <Button
                onClick={() => {
                  const preset = structuredClone(selected);
                  app.setSelected(restoreSelection(preset.selected));
                  app.setToolSettings(preset.toolSettings);
                  app.setMeasurementSettings(
                    normalizeMeasurementSettings({ ...preset.measurementSettings }),
                  );
                  app.setPingTargets(preset.pingTargets);
                  onNotice(`Preset “${preset.name}” applied.`);
                }}
              >
                Apply preset
              </Button>
              <Button onClick={() => writePreset(selected)}>Update from current tests</Button>
              <Button onClick={() => writePreset(selected, true)}>Rename</Button>
              <Button
                onClick={() => {
                  if (!window.confirm(`Delete preset “${selected.name}”?`)) return;
                  app.setPresets((current) => current.filter((item) => item.id !== selected.id));
                  setSelectedId('');
                  setName('');
                }}
              >
                Delete
              </Button>
            </>
          ) : (
            <Button onClick={() => writePreset()}>Save current tests</Button>
          )}
        </div>
      </div>
    </ToolPanel>
  );
}
