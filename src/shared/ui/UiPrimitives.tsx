import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  unstyled?: boolean;
}

export function Button({
  variant = 'secondary',
  unstyled = false,
  className = '',
  type = 'button',
  ...props
}: ButtonProps): ReactElement {
  const classes = unstyled ? className : `ui-button ${variant} ${className}`;
  return <button type={type} className={classes.trim()} {...props} />;
}

interface ButtonLinkProps {
  children: ReactNode;
  href: string;
  className?: string;
  variant?: Exclude<ButtonVariant, 'primary'>;
  external?: boolean;
  unstyled?: boolean;
}

export function ButtonLink({
  children,
  href,
  className = '',
  variant = 'secondary',
  external = false,
  unstyled = false,
}: ButtonLinkProps): ReactElement {
  const classes = unstyled ? className : `ui-button ${variant} ${className}`;
  return (
    <a
      className={classes.trim()}
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    >
      {children}
    </a>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return <section className={`ui-card ${className}`.trim()}>{children}</section>;
}

interface DataRowProps {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}

export function DataRow({ label, value, className = '' }: DataRowProps): ReactElement {
  return (
    <div className={className}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function SectionTitle({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return <div className={className}>{children}</div>;
}

interface EmptyStateProps {
  children: ReactNode;
  className?: string;
  tone?: 'neutral' | 'error';
}

export function EmptyState({
  children,
  className = '',
  tone = 'neutral',
}: EmptyStateProps): ReactElement {
  return <div className={`${className} empty-state ${tone}`.trim()}>{children}</div>;
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  className?: string;
  onLabel?: string;
  offLabel?: string;
  ariaLabel?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  className = '',
  onLabel = 'On',
  offLabel = 'Off',
  ariaLabel,
}: ToggleSwitchProps): ReactElement {
  return (
    <Button
      unstyled
      className={`toggle-switch ${className} ${checked ? 'on' : 'off'}`.trim()}
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
      aria-label={ariaLabel}
    >
      <span>{checked ? onLabel : offLabel}</span>
      <i />
    </Button>
  );
}

export function SelectionSwitch({
  selected,
  status = 'idle',
}: {
  selected: boolean;
  status?: 'idle' | 'ok' | 'error';
}): ReactElement {
  return (
    <span className={`selection-switch switch ${selected ? status : 'off'}`} aria-hidden="true">
      <i />
    </span>
  );
}

export function StatusIndicator({
  status,
  className = '',
}: {
  status: 'disconnected' | 'connecting' | 'connected';
  className?: string;
}): ReactElement {
  return (
    <span
      className={`status-indicator status-dot ${status} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

interface SegmentedControlProps<Value extends string> {
  value: Value;
  options: readonly (readonly [Value, string])[];
  onChange: (value: Value) => void | Promise<void>;
  className?: string;
}

export function SegmentedControl<Value extends string>({
  value,
  options,
  onChange,
  className = '',
}: SegmentedControlProps<Value>): ReactElement {
  return (
    <div className={`segmented-control ${className}`.trim()}>
      {options.map(([optionValue, label]) => (
        <Button
          unstyled
          key={optionValue}
          className={value === optionValue ? 'selected' : ''}
          aria-pressed={value === optionValue}
          onClick={() => {
            void onChange(optionValue);
          }}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  className?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function TextField({ label, className = '', ...inputProps }: TextFieldProps): ReactElement {
  return (
    <label className={`text-field ${className}`.trim()}>
      {label}
      <input {...inputProps} />
    </label>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
  className?: string;
}

export function SelectField({
  label,
  children,
  className = '',
  ...selectProps
}: SelectFieldProps): ReactElement {
  return (
    <label className={`select-field ${className}`.trim()}>
      {label}
      <select {...selectProps}>{children}</select>
    </label>
  );
}

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className = '',
}: PageHeaderProps): ReactElement {
  return (
    <header className={`page-header ${className}`.trim()}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className="page-header-actions">
        <p>{description}</p>
        {action}
      </div>
    </header>
  );
}
