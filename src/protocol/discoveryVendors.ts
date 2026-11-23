export function lookupDiscoveryVendor(
  mac: string,
  vendors: Record<string, string>,
): string | undefined {
  const key = mac.replace(/:/g, '').toUpperCase();
  // Locally administered and multicast addresses carry no reliable IEEE assignee.
  if (!/^[A-F0-9]{12}$/.test(key) || Number.parseInt(key.slice(0, 2), 16) & 3) return;
  for (const length of [9, 7, 6]) {
    const name = vendors[key.slice(0, length)];
    if (name) return name;
  }
}
