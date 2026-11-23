import { describeError, loadImages, loadManifest } from './firmware';
import { requestPort, selectTransport } from './serial';
import { updateDevice } from './updateDevice';
import type { UpdateMode } from './updateDevice';

const updateButton = document.querySelector<HTMLButtonElement>('#update')!;
const version = document.querySelector<HTMLParagraphElement>('#version')!;
const progress = document.querySelector<HTMLProgressElement>('#progress')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const failure = document.querySelector<HTMLDivElement>('#failure')!;
const copyButton = document.querySelector<HTMLButtonElement>('#copy-details')!;
const copyStatus = document.querySelector<HTMLParagraphElement>('#copy-status')!;
const settings = document.querySelector<HTMLDetailsElement>('#settings')!;
const modes = document.querySelector<HTMLFieldSetElement>('#modes')!;
const backupMode = document.querySelector<HTMLInputElement>('input[value="backup"]')!;

const diagnostics: string[] = [];

function renderStatus(message: string, state = '') {
  status.textContent = message;
  status.dataset.state = state;
}

function showFailure(error: unknown) {
  const message = describeError(error);
  diagnostics.push(message);
  renderStatus(message, 'error');
  failure.hidden = false;
}

copyButton.addEventListener('click', () => {
  void navigator.clipboard.writeText(diagnostics.join('\n')).then(
    () => (copyStatus.textContent = 'Diagnostic details copied.'),
    (error: unknown) => (copyStatus.textContent = `Copy failed. ${describeError(error)}`),
  );
});

async function initialize() {
  const transport = selectTransport();
  if (!window.isSecureContext || !transport) {
    renderStatus(
      'Open this updater in a browser with USB device access over HTTPS or localhost.',
      'error',
    );
    return;
  }

  const manifest = await loadManifest(new URL('./firmware/manifest.json', document.baseURI));
  version.textContent = `Version ${manifest.version}`;
  updateButton.disabled = false;
  renderStatus('Ready to connect.');

  async function startUpdate() {
    if (updateButton.disabled || !transport) return;
    const mode: UpdateMode = backupMode.checked ? 'backup' : 'fast';
    updateButton.disabled = true;
    modes.disabled = true;
    failure.hidden = true;
    copyStatus.textContent = '';
    progress.value = 0;
    diagnostics.length = 0;
    diagnostics.push(`Firmware ${manifest.version} (${manifest.page})`, `${transport} / ${mode}`);
    const log = (message: string) => diagnostics.push(message);
    let deviceUpdateStarted = false;
    try {
      // Request the device directly from the click so browser user activation is still valid.
      renderStatus('Select Pockethernet 2 in the device picker.');
      const port = await requestPort(transport);
      renderStatus('Downloading and checking firmware…');
      const images = await loadImages(manifest, log);
      deviceUpdateStarted = true;
      await updateDevice(port, images, mode, {
        onStage: (message) => {
          log(message);
          renderStatus(message);
        },
        onProgress: (fraction) => {
          progress.value = Math.max(progress.value, Math.min(1, fraction));
        },
        log,
      });
      progress.value = 1;
      renderStatus(
        'Firmware transfer complete. You can unplug the tester after it restarts.',
        'success',
      );
    } catch (error) {
      if (!deviceUpdateStarted && error instanceof DOMException && error.name === 'NotFoundError') {
        renderStatus('No tester selected.');
        return;
      }
      showFailure(error);
      if (deviceUpdateStarted && mode === 'fast') {
        backupMode.checked = true;
        settings.open = true;
      }
    } finally {
      updateButton.disabled = false;
      modes.disabled = false;
    }
  }

  updateButton.addEventListener('click', () => void startUpdate());
}

void initialize().catch(showFailure);
