import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState, useSyncExternalStore, type ReactElement } from 'react';
import { FirmwareUpdatePanel } from './FirmwareUpdatePanel';
import { ThemeSettings } from '@/shared/layout/ThemeSelector';
import type { FirmwareUpdateState } from './firmwareUpdateController';
import { createFirmwareUpdater } from './firmwareUpdateController';
import type { PockethernetClient } from '@/device/usePockethernet';
import { ToolInfoRow, ToolPanel } from '@/features/tools/ToolControls';

const device = {
  serial: 104716,
  hardwareVersion: 2,
  stmVersion: 17,
  espVersion: 16,
  mac: 'f4:65:0b:a3:2c:a3',
};
const check = {
  latestVersion: 17,
  downloadUrl: 'https://ota.pockethernet.com/pen_e_crypt_17.bin',
  updateAvailable: true,
  message: 'Update available: v17',
};
const state: FirmwareUpdateState = {
  phase: 'idle',
  checking: false,
  verifying: false,
  check,
  message: '',
  pending: null,
  advanced: false,
  selecting: false,
  selection: null,
};
const noop = (): void => {};
const meta = {
  title: 'Tools/Firmware update',
  component: FirmwareUpdatePanel,
  args: {
    deviceInfo: device,
    updater: {
      state,
      blockedReason: '',
      check: () => Promise.resolve(),
      confirm: noop,
      cancel: noop,
      start: () => Promise.resolve(),
      verify: () => Promise.resolve(),
      openAdvanced: () => {},
      closeAdvanced: () => {},
      chooseUrl: () => {},
      chooseFile: () => Promise.resolve(),
    },
  },
  decorators: [
    (Story, context) => (
      <div style={{ maxWidth: 460 }}>
        <ThemeSettings />
        <ToolPanel
          title="Device info"
          active={!!context.args.deviceInfo}
          summary={context.args.deviceInfo ? 'Connected device' : 'No device connected'}
        >
          <ToolInfoRow label="App version" value="Web migration" />
          {context.args.deviceInfo && (
            <>
              <ToolInfoRow label="Serial" value={String(context.args.deviceInfo.serial)} />
              <ToolInfoRow label="MAC" value={context.args.deviceInfo.mac} />
              <ToolInfoRow
                label="FW version"
                value={`${context.args.deviceInfo.espVersion}.${context.args.deviceInfo.stmVersion}`}
              />
            </>
          )}
          <Story />
        </ToolPanel>
      </div>
    ),
  ],
} satisfies Meta<typeof FirmwareUpdatePanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Available: Story = {};
export const Confirmation: Story = {
  args: { updater: { ...meta.args.updater, state: { ...state, phase: 'confirm' } } },
};
export const Installing: Story = {
  args: { updater: { ...meta.args.updater, state: { ...state, phase: 'installing' } } },
};
export const Dhcp: Story = {
  args: { updater: { ...meta.args.updater, state: { ...state, phase: 'dhcp' } } },
};
export const Restart: Story = {
  args: {
    deviceInfo: null,
    updater: {
      ...meta.args.updater,
      state: {
        ...state,
        phase: 'restart',
        message: 'Firmware v17 downloaded and verified. Restart Pockethernet to finish the update.',
      },
    },
  },
};
export const Unknown: Story = {
  args: {
    deviceInfo: null,
    updater: {
      ...meta.args.updater,
      state: {
        ...state,
        phase: 'unknown',
        message:
          'Update result was not received. The device may still be downloading or installing.',
      },
    },
  },
};
export const Failed: Story = {
  args: {
    updater: {
      ...meta.args.updater,
      state: {
        ...state,
        phase: 'failed',
        message: 'The firmware download was interrupted (code 14).',
      },
    },
  },
};
export const Verified: Story = {
  args: {
    updater: {
      ...meta.args.updater,
      state: {
        ...state,
        phase: 'verified',
        check: null,
        message: 'Update verified: Pockethernet is running ESP v17. STM firmware remains v17.',
      },
    },
  },
};
const narrowPreview: Decorator = (Story) => (
  <>
    <style>{'#storybook-root > div { width: 350px; max-width: 100%; }'}</style>
    <Story />
  </>
);
export const MobileConfirmation: Story = {
  ...Confirmation,
  decorators: [narrowPreview],
};
export const MobileAvailable: Story = { decorators: [narrowPreview] };
export const Blocked: Story = {
  args: { updater: { ...meta.args.updater, blockedReason: 'Turn off the WiFi bridge first.' } },
};
export const AdvancedUrl: Story = {
  args: { updater: { ...meta.args.updater, state: { ...state, advanced: true } } },
};
export const CustomFileReview: Story = {
  args: {
    updater: {
      ...meta.args.updater,
      state: {
        ...state,
        phase: 'confirm',
        advanced: true,
        selection: {
          ...check,
          source: 'file',
          latestVersion: 16,
          label: 'pen_e_custom_experimental_16_identityfix.bin',
          bytes: 1276736,
          downloadUrl: '',
        },
      },
    },
  },
};
function InteractivePreview(): ReactElement {
  const [controller] = useState(() => {
    const memory = new Map<string, string>();
    const unsupported = (): Promise<never> =>
      Promise.reject(new Error('Preview only: no hardware writes or uploads.'));
    const client: PockethernetClient = {
      status: 'connected',
      device: 'Preview',
      info: device,
      batteryPercent: 80,
      error: '',
      clearError: noop,
      connect: unsupported,
      disconnect: noop,
      request: unsupported,
      send: unsupported,
      waitFor: unsupported,
      collectFor: unsupported,
    };
    return createFirmwareUpdater({
      getClient: () => client,
      getBlockedReason: () => '',
      onLockChange: noop,
      uploadFile: unsupported,
      fetchLatest: () => Promise.resolve(new Response(`17#${check.downloadUrl}`)),
      storage: {
        getItem: (key) => memory.get(key) ?? null,
        setItem: (key, value) => {
          memory.set(key, value);
        },
        removeItem: (key) => {
          memory.delete(key);
        },
      },
    });
  });
  const current = useSyncExternalStore(controller.subscribe, controller.getState);
  return (
    <FirmwareUpdatePanel
      deviceInfo={device}
      updater={{
        state: current,
        blockedReason: '',
        check: controller.check,
        confirm: controller.confirm,
        cancel: controller.cancel,
        start: controller.start,
        verify: controller.verify,
        openAdvanced: controller.openAdvanced,
        closeAdvanced: controller.closeAdvanced,
        chooseUrl: controller.chooseUrl,
        chooseFile: controller.chooseFile,
      }}
    />
  );
}
export const InteractiveAdvanced: Story = { render: () => <InteractivePreview /> };
