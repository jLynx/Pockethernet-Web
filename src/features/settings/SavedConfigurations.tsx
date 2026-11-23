import { useState, type ReactElement } from 'react';
import { normalizeSelection } from '@/app/testSelection';
import type { MeasurementPreset, ReportJob } from '@/app/savedConfigurations';
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
    <ToolPanel title="Presets" disabled={disabled}>
      <div className="settings-fields">
        <SelectField
          label="Saved preset"
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
                  app.setSelected(normalizeSelection(preset.selected));
                  app.setToolSettings(preset.toolSettings);
                  app.setMeasurementSettings(preset.measurementSettings);
                  app.setPingTargets(preset.pingTargets);
                  onNotice(`Preset “${preset.name}” applied.`);
                }}
              >
                Apply
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

export function JobSettings({ app, disabled, onNotice }: SettingsProps): ReactElement {
  const [editId, setEditId] = useState('');
  const [name, setName] = useState('');
  const [site, setSite] = useState('');
  const [numberPattern, setNumberPattern] = useState('');
  const selected = app.jobs.find((job) => job.id === editId);
  const edit = (job?: ReportJob): void => {
    setEditId(job?.id ?? '');
    setName(job?.name ?? '');
    setSite(job?.site ?? '');
    setNumberPattern(job?.numberPattern ?? '');
  };
  const save = (): void => {
    const label = name.trim();
    const pattern = numberPattern.trim();
    if (
      !label ||
      app.jobs.some(
        (job) => job.id !== editId && job.name.toLocaleLowerCase() === label.toLocaleLowerCase(),
      )
    ) {
      onNotice(label ? 'A job with that name already exists.' : 'Enter a job name.');
      return;
    }
    if (pattern && !pattern.includes('#')) {
      onNotice('Include # where the report number should appear, for example CAB-###.');
      return;
    }
    const job = {
      id: selected?.id ?? crypto.randomUUID(),
      name: label,
      site: site.trim(),
      numberPattern: pattern,
    };
    app.setJobs((current) =>
      selected ? current.map((item) => (item.id === selected.id ? job : item)) : [...current, job],
    );
    app.selectReportJob(job);
    edit(job);
    onNotice(`Job “${job.name}” selected.`);
  };
  return (
    <ToolPanel title="Jobs" disabled={disabled}>
      <div className="settings-fields">
        <SelectField
          label="Manage job"
          value={selected?.id ?? ''}
          onChange={(event) => edit(app.jobs.find((job) => job.id === event.target.value))}
        >
          <option value="">New job</option>
          {app.jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Job name"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Job site"
          value={site}
          maxLength={160}
          onChange={(event) => setSite(event.target.value)}
        />
        <TextField
          label="Automatic report number (optional)"
          placeholder="CAB-###"
          value={numberPattern}
          maxLength={80}
          onChange={(event) => setNumberPattern(event.target.value)}
        />
        <div className="batch-save-actions">
          <Button onClick={save}>{selected ? 'Save job' : 'Create job'}</Button>
          {selected && (
            <Button
              onClick={() => {
                if (!window.confirm(`Remove job “${selected.name}”? Its reports stay in Reports.`))
                  return;
                app.setJobs((current) => current.filter((job) => job.id !== selected.id));
                if (app.jobId === selected.id) app.selectReportJob();
                edit();
              }}
            >
              Remove job
            </Button>
          )}
        </div>
      </div>
    </ToolPanel>
  );
}
