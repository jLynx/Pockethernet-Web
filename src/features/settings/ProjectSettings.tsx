import { useState, type ReactElement } from 'react';
import type { useAppSettings } from '@/app/useAppSettings';
import type { ReportProject } from '@/app/savedConfigurations';
import { ToolPanel } from '@/features/tools/ToolControls';
import { Button, SelectField, TextField } from '@/shared/ui/UiPrimitives';

interface ProjectSettingsProps {
  app: ReturnType<typeof useAppSettings>;
  disabled: boolean;
  onNotice: (message: string) => void;
}

type CableIdMode = 'manual' | 'increment' | 'assign';

export function ProjectSettings(props: ProjectSettingsProps): ReactElement {
  const { app, disabled } = props;
  return (
    <ToolPanel title="Projects" disabled={disabled}>
      <div className="settings-fields">
        <SelectField
          label="Current project"
          value={app.project?.id ?? ''}
          onChange={(event) => app.setProjectId(event.target.value)}
        >
          <option value="">Unsaved project</option>
          {app.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </SelectField>
        <ProjectDetails key={app.project?.id ?? ''} {...props} />
      </div>
    </ToolPanel>
  );
}

function ProjectDetails({ app, onNotice }: ProjectSettingsProps): ReactElement {
  const project = app.project;
  const batch = app.workflowMode === 'batch';
  const increment = project?.incrementCableId ?? app.autoIncrement;
  const [name, setName] = useState(project?.name ?? '');
  const [site, setSite] = useState(project?.site ?? '');
  const [numberPattern, setNumberPattern] = useState(project?.numberPattern ?? '');
  const [cableIdMode, setCableIdMode] = useState<CableIdMode>(
    project?.numberPattern ? 'assign' : batch && increment ? 'increment' : 'manual',
  );
  const label = (project ? name : (app.reportDetails.project ?? '')).trim();
  const address = (project ? site : app.reportDetails.address).trim();
  const save = (): void => {
    const pattern = cableIdMode === 'assign' ? numberPattern.trim() : '';
    if (
      app.projects.some(
        (item) => item.id !== project?.id && item.name.toLowerCase() === label.toLowerCase(),
      )
    ) {
      onNotice('A saved project already uses that name.');
      return;
    }
    if (cableIdMode === 'assign' && !pattern.includes('#')) {
      onNotice('Include # where the number should appear, for example CAB-###.');
      return;
    }
    const saved: ReportProject = {
      id: project?.id ?? crypto.randomUUID(),
      name: label,
      site: address,
      numberPattern: pattern,
      incrementCableId: batch && cableIdMode !== 'assign' ? cableIdMode === 'increment' : increment,
    };
    app.setProjects((current) =>
      project
        ? current.map((item) => (item.id === project.id ? saved : item))
        : [...current, saved],
    );
    app.setProjectId(saved.id);
    setName(saved.name);
    setSite(saved.site);
    setNumberPattern(saved.numberPattern);
    onNotice(`Project “${saved.name}” saved.`);
  };
  return (
    <>
      <TextField
        label="Project name"
        value={project ? name : (app.reportDetails.project ?? '')}
        maxLength={160}
        onChange={(event) => {
          const value = event.target.value;
          if (project) setName(value);
          else app.setReportDetails((current) => ({ ...current, project: value }));
        }}
      />
      <TextField
        label="Address / site"
        value={project ? site : app.reportDetails.address}
        maxLength={160}
        onChange={(event) => {
          const value = event.target.value;
          if (project) setSite(value);
          else app.setReportDetails((current) => ({ ...current, address: value }));
        }}
      />
      <SelectField
        label="Cable ID"
        value={cableIdMode}
        onChange={(event) => {
          const value = event.target.value;
          const mode = value === 'assign' || value === 'increment' ? value : 'manual';
          setCableIdMode(mode);
          if (batch && !project && mode !== 'assign') app.setAutoIncrement(mode === 'increment');
        }}
      >
        <option value="manual">Enter manually</option>
        {batch && <option value="increment">Increment after Save &amp; next</option>}
        <option value="assign">Assign on save</option>
      </SelectField>
      {cableIdMode === 'increment' && (
        <p className="settings-hint">
          Enter the first Cable ID on Test. Save &amp; next advances past IDs already used in this
          project and site.
        </p>
      )}
      {cableIdMode === 'assign' && (
        <>
          <TextField
            label="Cable ID pattern"
            placeholder="CAB-###"
            value={numberPattern}
            maxLength={80}
            onChange={(event) => setNumberPattern(event.target.value)}
          />
          <p className="settings-hint">
            Use # for digits, for example CAB-### for CAB-001. Save the project to apply the
            pattern.
          </p>
        </>
      )}
      <div className="batch-save-actions">
        <Button onClick={save} disabled={!label}>
          {project ? 'Save changes' : 'Save project'}
        </Button>
        {project && (
          <Button
            onClick={() => {
              if (window.confirm(`Remove project “${project.name}”? Its reports stay in Reports.`))
                app.removeProject(project.id);
            }}
          >
            Remove project
          </Button>
        )}
      </div>
      {(['user', 'location'] as const).map((field) => (
        <TextField
          key={field}
          label={field === 'user' ? 'Technician' : 'Location'}
          value={app.reportDetails[field]}
          maxLength={160}
          onChange={(event) => {
            const value = event.target.value;
            app.setReportDetails((current) => ({ ...current, [field]: value }));
          }}
        />
      ))}
    </>
  );
}
