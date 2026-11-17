import { useEffect, useState } from 'react';
import type { StateSetter } from './types';

export function useStoredState<T>(key: string, load: () => T): [T, StateSetter<T>] {
  const [value, setValue] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Keep settings usable when browser storage is unavailable. */
    }
  }, [key, value]);
  return [value, setValue];
}
