import type { FirmwareVersionResult } from '@/pockethernetProtocol';

/** latestVersion is the selected ESP version, including a reinstall or downgrade. */
export interface EthernetUpdateTarget extends FirmwareVersionResult {
  method?: 'ethernet';
  source?: 'official' | 'url' | 'file';
  label?: string;
  sha256?: string;
  bytes?: number;
}

export interface UsbUpdateTarget {
  method: 'usb';
  latestVersion: number;
  updateAvailable: boolean;
  message: string;
}

export type FirmwareUpdateTarget = (EthernetUpdateTarget | UsbUpdateTarget) & { warning?: string };

export type FirmwareCheck = FirmwareUpdateTarget | { error: string };
