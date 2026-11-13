import { createContext, useContext } from 'react';
import type { DecimalSeparator } from './numberFormat';

export const DecimalContext = createContext<DecimalSeparator>('.');

export function useDecimalSeparator(): DecimalSeparator {
  return useContext(DecimalContext);
}
