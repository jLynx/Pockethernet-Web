export const MIN_ESP_FIRMWARE = {
  discovery: 18,
  ber: 15,
  dhcpVendorClass: 18,
  captivePortal: 18,
  tdrOversizeNack: 25,
  dhcpClasslessRoutes: 32,
  advancedDiscovery: 32,
  tonerMelody: 32,
  idleAutoOff: 32,
} as const;

export function firmwareSupports(
  version: number | undefined,
  feature: keyof typeof MIN_ESP_FIRMWARE,
): boolean {
  return version !== undefined && version >= MIN_ESP_FIRMWARE[feature];
}

export function firmwareRequirement(feature: keyof typeof MIN_ESP_FIRMWARE): string {
  return `Requires firmware V${MIN_ESP_FIRMWARE[feature]}+`;
}

export function firmwareUnavailableReason(
  version: number | undefined,
  feature: keyof typeof MIN_ESP_FIRMWARE,
): string | undefined {
  if (version === undefined) return 'Checking firmware version…';
  return firmwareSupports(version, feature) ? undefined : firmwareRequirement(feature);
}
