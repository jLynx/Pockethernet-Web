export type DecimalSeparator = '.' | ',';

export function formatDecimal(
  value: number,
  digits = 1,
  separator: DecimalSeparator = '.',
): string {
  return value.toFixed(digits).replace('.', separator);
}

export function formatScalar(text: string, separator: DecimalSeparator = '.'): string {
  // Only format a scalar measurement, never an address, version or free-form note.
  return /^-?\d+\.\d+(?:\s*(?:%|ppm|ms|V|m|ft|ns))?$/.test(text)
    ? text.replace('.', separator)
    : text;
}
