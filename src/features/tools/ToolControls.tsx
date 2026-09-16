import type { ChangeEvent, InputHTMLAttributes, ReactElement, ReactNode } from 'react';
import {
  Button,
  ButtonLink,
  Card,
  DataRow,
  SegmentedControl,
  TextField,
} from '@/shared/ui/UiPrimitives';

interface ToolPanelProps {
  title: string;
  active: boolean;
  summary: string;
  children: ReactNode;
  className?: string;
}

export function ToolPanel({
  title,
  active,
  summary,
  children,
  className = '',
}: ToolPanelProps): ReactElement {
  return (
    <Card className={`tool-panel ${className} ${active ? 'active' : ''}`}>
      <header className="tool-panel-header">
        <div>
          <h2>{title}</h2>
          <p>{summary}</p>
        </div>
        <span className="tool-status">{active ? 'Active' : 'Ready'}</span>
      </header>
      <div className="tool-controls">{children}</div>
    </Card>
  );
}

interface ToolControlProps<Name extends string, Value extends string> {
  label: string;
  name: Name;
  value: Value;
  options: readonly (readonly [Value, string])[];
  onChange: (name: Name, value: Value) => void | Promise<void>;
}

export function ToolControl<Name extends string, Value extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: ToolControlProps<Name, Value>): ReactElement {
  return (
    <fieldset className="tool-control">
      <legend>{label}</legend>
      <SegmentedControl
        className="tool-segmented"
        value={value}
        options={options}
        onChange={(optionValue) => onChange(name, optionValue)}
      />
    </fieldset>
  );
}

interface ToolFieldProps {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  disabled?: boolean;
}

export function ToolField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  disabled = false,
}: ToolFieldProps): ReactElement {
  return (
    <TextField
      className="tool-field"
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      inputMode={inputMode}
      disabled={disabled}
    />
  );
}

export function ToolInfoRow({ label, value }: { label: string; value: string }): ReactElement {
  return <DataRow className="tool-info-row" label={label} value={value} />;
}

interface ToolActionProps {
  label: string;
  action: string;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
}

export function ToolAction({
  label,
  action,
  disabled = true,
  onClick,
  href,
}: ToolActionProps): ReactElement {
  return (
    <div className="tool-action">
      <span>{label}</span>
      {href ? (
        <ButtonLink unstyled className="tool-action-button" href={href} external>
          {action}
        </ButtonLink>
      ) : (
        <Button unstyled disabled={disabled} onClick={onClick}>
          {action}
        </Button>
      )}
    </div>
  );
}
