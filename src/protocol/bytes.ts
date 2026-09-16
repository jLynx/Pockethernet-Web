export function bytesToIpv4(bytes: Uint8Array, offset = 0): string {
  return Array.from(bytes.slice(offset, offset + 4)).join('.');
}

export function decodeText(payload: Uint8Array, start: number, end: number): string {
  return new TextDecoder().decode(payload.slice(start, end)).replace(/\0+$/, '').trim();
}

export function formatMac(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
}

export function formatIpv6(bytes: Uint8Array): string {
  const groups = Array.from({ length: 8 }, (_, index) =>
    ((bytes[index * 2] << 8) | bytes[index * 2 + 1]).toString(16),
  );
  let bestStart = -1;
  let bestLength = 0;
  for (let start = 0; start < 8; start += 1) {
    if (groups[start] !== '0') continue;
    let end = start;
    while (end < 8 && groups[end] === '0') end += 1;
    if (end - start > bestLength) {
      bestStart = start;
      bestLength = end - start;
    }
    start = end - 1;
  }
  if (bestLength > 1) {
    const left = groups.slice(0, bestStart).join(':');
    const right = groups.slice(bestStart + bestLength).join(':');
    return (
      left && right ? `${left}::${right}` : left ? `${left}::` : right ? `::${right}` : '::'
    ).toUpperCase();
  }
  return groups.join(':').toUpperCase();
}
