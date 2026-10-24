import { useSyncExternalStore, type ReactElement } from 'react';
import { FiMonitor, FiMoon, FiSun } from 'react-icons/fi';
import { getThemePreference, setThemePreference, subscribeTheme } from '@/app/theme';
import { Button } from '@/shared/ui/UiPrimitives';

export function ThemeSelector(): ReactElement {
  const preference = useSyncExternalStore(subscribeTheme, getThemePreference);
  const options = [
    { value: 'system', label: 'Device', icon: FiMonitor },
    { value: 'light', label: 'Light', icon: FiSun },
    { value: 'dark', label: 'Dark', icon: FiMoon },
  ] as const;
  return (
    <div className="theme-options" role="group" aria-label="Colour theme">
      {options.map(({ value, label, icon: OptionIcon }) => (
        <Button
          key={value}
          unstyled
          className={`theme-option ${preference === value ? 'selected' : ''}`}
          aria-pressed={preference === value}
          onClick={() => setThemePreference(value)}
        >
          <OptionIcon aria-hidden="true" />
          {label}
        </Button>
      ))}
    </div>
  );
}

export function ThemeSettings(): ReactElement {
  return (
    <section className="theme-settings" aria-label="Appearance">
      <h2>Appearance</h2>
      <p>Choose a theme. Device follows your device’s light or dark setting.</p>
      <ThemeSelector />
    </section>
  );
}
