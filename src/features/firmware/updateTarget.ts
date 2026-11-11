import type { FirmwareVersionResult } from '@/pockethernetProtocol';

/** latestVersion is the selected ESP version, including a reinstall or downgrade. */
export interface FirmwareUpdateTarget extends FirmwareVersionResult {
  source?: 'official' | 'url' | 'file';
  label?: string;
  sha256?: string;
  bytes?: number;
}
