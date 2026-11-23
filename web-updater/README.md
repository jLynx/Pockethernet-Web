# Pocketweb USB firmware updater

This standalone entry point installs the official Pockethernet 2 firmware over USB. Its TypeScript implementation follows the update sequence recovered from `webflash-v32.2`. It shares packet encoding with Pocketweb and uses Espressif’s `esptool-js` for the ESP stage.

## Local development

From the repository root:

```powershell
npm ci
npm run dev:updater
```

Open the URL Vite prints in Chrome or Edge. The default is [localhost:5174](http://localhost:5174/). The development server fetches the manifest and three firmware images from the [official updater](https://pockethernet.com/update/). Web Serial is preferred on desktop. Chrome on Android uses the WebUSB CDC adapter when available. A physical Pockethernet 2 must be switched off before it is plugged in. The page enables installation only after it can read a supported manifest, and it validates the three downloads before opening the selected device.

## Build and hosting

`npm run build:updater` builds the standalone site and its third-party license notices into `web-updater/dist`. For testing the built site with live official firmware, run `npm run preview:updater` and open [the preview](http://localhost:4174/).

For a deployed standalone site, serve the build over HTTPS. Configure same-origin HTTP routes for `firmware/manifest.json` and `firmware/images/*.bin` beneath the updater’s URL. The development and preview servers map those paths to `/update/` on `pockethernet.com`. The official server does not send cross-origin access headers. A static deployment can serve a matched manifest and image set placed under `web-updater/public/firmware/` before building, where redistribution is authorized. That path is ignored by Git. The official page identifies its firmware and updater as proprietary.

## Third-party libraries

The official updater lists `esptool-js` 0.7.0, `pako` 2.1.0, and `atob-lite` 2.0.0. Pocketweb uses `esptool-js` 0.7.0 with its dependencies `pako` 2.2.0 and `atob-lite` 2.0.0. It also uses `@noble/hashes` for the ESP loader’s MD5 callback. Vite writes the notices for the actual bundled versions to `dist/third-party-licenses.md`. [Official updater license list](https://pockethernet.com/update/licenses.txt)

## Integration points

- `main.ts` binds the standalone controls to the firmware source, device picker and updater. Pocketweb can call the same modules from a React component.
- `firmware.ts` reads the manifest, checks the expected layout, and validates exact sizes and SHA-256 digests. Those digests verify agreement with the manifest. Serve both from a trusted source.
- `serial.ts` selects Web Serial or WebUSB and adapts the Pockethernet USB CDC interface to serial streams.
- `updateDevice.ts` probes USB bootloader mode, programs the two ESP image regions with Espressif’s loader, returns to the STM bootloader, transfers the packaged STM image with a separate acknowledgement per block, and requests a reboot.
- `usbProtocol.ts` handles split replies, checksum validation, serial timeouts and the USB packet padding quirk.

The standalone page’s completion message reflects the transfer and reboot request. Check the reported firmware version after reconnecting to confirm the new firmware booted.
