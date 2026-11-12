import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsPage } from './SettingsPage';
import type { FirmwareUpdaterActions } from '@/features/firmware/useFirmwareUpdater';

const device = {
  serial: 104716,
  hardwareVersion: 2,
  stmVersion: 17,
  espVersion: 17,
  mac: 'F4:65:0B:A3:2C:A3',
};
const noop = (): void => {};
const resolve = (): Promise<void> => Promise.resolve();
const firmwareUpdater: FirmwareUpdaterActions = {
  state: {
    phase: 'idle',
    checking: false,
    verifying: false,
    check: null,
    message: '',
    pending: null,
    advanced: false,
    selecting: false,
    selection: null,
  },
  blockedReason: '',
  check: resolve,
  confirm: noop,
  cancel: noop,
  start: resolve,
  verify: resolve,
  openAdvanced: noop,
  closeAdvanced: noop,
  chooseUrl: noop,
  chooseFile: resolve,
};

const meta = {
  title: 'Settings/Page',
  component: SettingsPage,
  args: {
    deviceInfo: null,
    firmwareUpdater,
    resetDisabled: false,
    onReset: resolve,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disconnected: Story = {};
export const Connected: Story = { args: { deviceInfo: device } };
export const FirmwareAvailable: Story = {
  args: {
    deviceInfo: { ...device, espVersion: 16 },
    firmwareUpdater: {
      ...firmwareUpdater,
      state: {
        ...firmwareUpdater.state,
        check: {
          latestVersion: 17,
          downloadUrl: 'https://ota.pockethernet.com/pen_e_crypt_17.bin',
          updateAvailable: true,
          message: 'Update available: v17',
        },
      },
    },
  },
};
