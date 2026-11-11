import { useState, type ReactElement } from 'react';
import { Button, SegmentedControl, TextField } from '@/shared/ui/UiPrimitives';
import type { FirmwareUpdaterActions } from './useFirmwareUpdater';

export function AdvancedFirmwareForm({
  updater,
}: {
  updater: FirmwareUpdaterActions;
}): ReactElement {
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [version, setVersion] = useState('');
  const [host, setHost] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.origin,
  );
  const busy = updater.state.selecting || !!updater.blockedReason;
  return (
    <section
      className="firmware-status firmware-advanced"
      aria-label="Advanced ESP firmware update"
    >
      <h3>Advanced ESP update</h3>
      <p>
        Install a custom ESP OTA package, including the same version or an older version. STM
        firmware stays unchanged.
      </p>
      <SegmentedControl
        value={mode}
        options={[
          ['url', 'Custom URL'],
          ['file', 'OTA file'],
        ]}
        onChange={setMode}
      />
      {mode === 'url' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            updater.chooseUrl(url, Number(version));
          }}
        >
          <TextField
            label="OTA download URL"
            type="url"
            value={url}
            required
            placeholder="http://192.168.1.161:8765/fw.bin"
            onChange={(event) => setUrl(event.target.value)}
          />
          <TextField
            label="Expected ESP version after boot"
            type="number"
            min="1"
            max="2147483647"
            value={version}
            required
            onChange={(event) => setVersion(event.target.value)}
          />
          <p className="firmware-detail">
            Use a direct HTTP(S) link reachable from Pockethernet’s Ethernet port, at most 60 ASCII
            characters. Browser authentication and localhost links will not work.
          </p>
          <Button type="submit" variant="primary" disabled={busy}>
            Review URL update
          </Button>
        </form>
      ) : (
        <div className="firmware-file-choice">
          <p>
            Choose a packaged PEUI ESP OTA .bin file. The ESP version is read from its header. Raw
            PlatformIO images and USB flash dumps are not OTA packages.
          </p>
          <p className="firmware-detail">
            When you start the update, the file is uploaded to Pocketweb and hosted for 30 minutes.
            Anyone with its random download link can fetch it until it expires.
          </p>
          <TextField
            label="Download host"
            type="url"
            value={host}
            onChange={(event) => setHost(event.target.value)}
          />
          <p className="firmware-detail">
            On the live site, keep the Pocketweb host. For local development, use the local Worker’s
            LAN address, for example http://192.168.1.161:8787.
          </p>
          <label className="firmware-file-input">
            ESP OTA package
            <input
              type="file"
              accept=".bin,application/octet-stream"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void updater.chooseFile(file, host);
                event.target.value = '';
              }}
            />
          </label>
          {updater.state.selecting && <p role="status">Inspecting OTA file...</p>}
        </div>
      )}
      {updater.blockedReason && <p>{updater.blockedReason}</p>}
      <Button onClick={updater.closeAdvanced}>Close advanced update</Button>
    </section>
  );
}
