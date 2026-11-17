import type { ReactElement, ReactNode } from 'react';
import { DecimalContext } from './decimalPreference';
import type { DecimalSeparator } from './numberFormat';

export function NumberFormatProvider({
  separator,
  children,
}: {
  separator: DecimalSeparator;
  children: ReactNode;
}): ReactElement {
  return <DecimalContext.Provider value={separator}>{children}</DecimalContext.Provider>;
}
