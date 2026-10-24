export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pockethernet.theme';

let currentPreference: ThemePreference | undefined;
const listeners = new Set<() => void>();
let stopListening: (() => void) | undefined;

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function loadThemePreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function resolveTheme(preference: ThemePreference, deviceIsDark: boolean): 'light' | 'dark' {
  return preference === 'system' ? (deviceIsDark ? 'dark' : 'light') : preference;
}

export function applyTheme(preference: ThemePreference, deviceIsDark: boolean): void {
  const theme = resolveTheme(preference, deviceIsDark);
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#141e2c' : '#246fc5');
}

export function getThemePreference(): ThemePreference {
  return (currentPreference ??= loadThemePreference());
}

function updateTheme(): void {
  applyTheme(getThemePreference(), window.matchMedia('(prefers-color-scheme: dark)').matches);
  listeners.forEach((listener) => listener());
}

export function setThemePreference(preference: ThemePreference): void {
  currentPreference = preference;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Keep the current selection usable when browser storage is unavailable.
  }
  updateTheme();
}

export function subscribeTheme(listener: () => void): () => void {
  if (listeners.size === 0) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncPreference = (event: StorageEvent): void => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        currentPreference = loadThemePreference();
        updateTheme();
      }
    };
    media.addEventListener('change', updateTheme);
    window.addEventListener('storage', syncPreference);
    stopListening = () => {
      media.removeEventListener('change', updateTheme);
      window.removeEventListener('storage', syncPreference);
    };
    updateTheme();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopListening?.();
      stopListening = undefined;
    }
  };
}
