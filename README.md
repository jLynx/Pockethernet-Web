# 🔌 [Pocketweb for Pockethernet](https://pockethernet.jlynx.net/)

[![Pocketweb Live](https://img.shields.io/badge/Live-pockethernet.jlynx.net-success?style=for-the-badge&logo=cloudflare)](https://pockethernet.jlynx.net/)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Web Bluetooth](https://img.shields.io/badge/Web%20Bluetooth-Device%20Connection-0082FC?style=for-the-badge&logo=bluetooth&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)

Pocketweb for Pockethernet is a modern, installable browser application built specifically for Pockethernet 2 hardware. It connects directly over Web Bluetooth and provides cable diagnostics, network measurements, device tools, and shareable PDF reports without requiring a native mobile app. The original first-generation Pockethernet is not currently supported, but support may be considered if there is enough community interest.

> Pockethernet is a registered trademark of Pockethernet Ltd. This web application is an independent, open-source project and is not affiliated with, endorsed by, or sponsored by Pockethernet Ltd.

## What this project adds

- A redesigned responsive interface for desktop and mobile workflows
- Selectable multi-test runs with live status and expandable results
- Interactive TDR impedance and crosstalk charts
- Saved measurement history with photos, site metadata, and custom branding
- PDF preview, download, multi-report export, and native sharing
- Installable PWA support with an offline application shell
- Persistent cable, network, and reporting preferences
- Reusable typed protocol, device, UI, and feature modules

## Compatibility approach

This is an original React/TypeScript application with its own interface, architecture, state management, reporting system, and browser-focused workflows. Pockethernet 2 compatibility was developed from device testing, observed behavior, public networking standards, and technical analysis of the original software where needed to understand the device protocol.

Low-level packet research, app decompilation, and implementation notes are kept separately in [Protocol research](docs/PROTOCOL_RESEARCH.md).

## Quick start

Requirements:

- Pockethernet 2 device; first-generation hardware is not currently supported, but may be added if enough people request it
- Node.js and npm
- Desktop Chrome or Edge
- Bluetooth enabled
- The page served from `localhost` or HTTPS (Web Bluetooth requires a secure context)

From the repository root:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite, click **Connect**, and select the Pockethernet device in the browser Bluetooth chooser.

## Install and use offline

The production build is an installable PWA. Open the deployed HTTPS site in Chrome or Edge and use the browser's **Install app** action. After the first successful load, the application shell and bundled assets are cached and can be reopened without an internet connection. Bluetooth must still be enabled to connect to a Pockethernet device.

Production check:

```powershell
npm run build
```

## Cloudflare Workers

This is a static React SPA served through Cloudflare Workers Assets. The Pockethernet connection still runs in the browser through Web Bluetooth; the Worker does not access Bluetooth hardware.

Run the built app through Wrangler locally:

```powershell
npm run worker:dev
```

Deploy it to the Cloudflare account configured in Wrangler:

```powershell
npm run deploy
```

The Worker uses SPA fallback routing so client-side routes resolve to `index.html`.

## Development checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

## Current architecture

| File                               | Responsibility                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                      | Top-level state, navigation, and device action coordination.                                                  |
| `src/app`                          | Application-wide types, settings persistence, formatting, measurement orchestration, and composition stories. |
| `src/device`                       | Typed Web Bluetooth transport, notifications, and request/reply matching.                                     |
| `src/features/measurements`        | Measurement page, result components, stories, and feature-specific styles.                                    |
| `src/features/reports`             | Saved report management, image handling, branded PDF generation, preview, download, and sharing.              |
| `src/features/tools`               | Tools page, controls, stories, and feature-specific styles.                                                   |
| `src/shared/layout`                | Reusable application shell, navigation, panel, and status components.                                         |
| `src/shared/ui`                    | Reusable UI primitives, their stories, and primitive styles.                                                  |
| `src/protocol`                     | Protocol types, constants, framing, commands, and domain-specific parsers.                                    |
| `src/pockethernetProtocol.ts`      | Compatibility barrel for the protocol modules.                                                                |
| `src/styles.css`                   | Base application and test-panel styling.                                                                      |
| `src/pockethernetProtocol.test.ts` | Synthetic protocol regression tests.                                                                          |

Feature modules may import from `app`, `device`, `protocol`, and `shared`. Shared modules must remain feature-independent so they can be reused without creating circular dependencies. Components, stories, and styles that belong to one feature should stay colocated in that feature folder. Use the `@/` source alias for cross-folder imports and relative paths for files in the same folder.

All TypeScript, TSX, and CSS source files are limited to 300 physical lines. `npm run lint` enforces the limit alongside type-aware TypeScript and CSS rules.

The BLE transport handles framed messages, checksums, notifications, request/reply matching, and browser-compatible chunked writes. Protocol parsing is separated from React so measurement behavior can be covered by synthetic regression tests.

## Feature status

| Module               | Status                                                                   | Notes                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bluetooth connection | Implemented and device-tested                                            | Connect/disconnect, notifications, command writes, response matching, ACK/NACK handling, CRC, and COBS are working.                                                                                                                                           |
| Device information   | Implemented                                                              | Requested during connection and displayed in the device tools panel.                                                                                                                                                                                          |
| Wiremap              | Implemented and device-tested                                            | Supports adapter V1/V2 detection, straight/crossover/rollover/miswire/open/short/unknown wires, shield state, adapter ID, and the dynamic diagram.                                                                                                            |
| TDR                  | Implemented and device-tested                                            | Sends the required diagnostic setup and four-pair TDR commands, decompresses traces, detects peaks, and reports Open/Short/Terminated plus distance.                                                                                                          |
| TDR Graph            | Implemented and device-tested                                            | Reuses the four impedance traces, requests six crosstalk traces with packet `61969`, and renders interactive charts with a distance cursor.                                                                                                                   |
| PoE                  | Implemented and device-tested                                            | Sends packet `61520`, decodes the 32-byte PoE response, and displays PSE type, voltages, polarity, class, and pair readings.                                                                                                                                  |
| Link                 | Implemented and device-tested                                            | Configures auto-negotiation, decodes link speed/duplex, partner capabilities, polarity, skew delay, and cable-length estimate.                                                                                                                                |
| CDP/LLDP             | Implemented and device-tested                                            | Enables CDP/LLDP Ethernet filters, parses async packet `62032` frames, and displays advertisement fields.                                                                                                                                                     |
| VLAN                 | Implemented; physical validation pending                                 | Configures VLAN tag collection, supports outgoing VLAN tagging and VLAN ID input, collects async packet `62020` values, and displays detected VLAN IDs with priority and DEI.                                                                                 |
| Traffic              | Implemented and device-tested                                            | Configures Ethernet traffic filtering, collects asynchronous packet `62032` frames for 30 seconds, deduplicates source/destination/VLAN combinations, and displays untagged, VLAN-tagged, multicast, and broadcast traffic.                                   |
| IPv4                 | Implemented and device-tested                                            | Supports DHCPv4/static configuration, parses DHCP responses, and displays assigned address, routing, DNS, lease, and server details.                                                                                                                          |
| IPv6                 | Implemented and device-tested                                            | Supports SLAAC, DHCPv6, or both modes, configures IPv6 discovery, parses Router Advertisement and DHCPv6 responses, and displays discovered IPv6 details.                                                                                                     |
| Ping                 | Implemented and device-tested                                            | Sends sequential Ping requests for up to three entered IP/domain targets, parses binary IPv4/IPv6 addresses and RTT/timeout results, and displays per-server details.                                                                                         |
| External IP          | Implemented and device-tested                                            | Enables DHCP on the Pockethernet, requests the public-IP lookup through packet `62064`, parses the JSON response, and displays IP, AS, ISP, and Geo IP fields.                                                                                                |
| Error rate / BER     | Implemented and device-tested                                            | Configures the Ethernet link, sends BER batches, and displays sent, received, error, and error-rate totals.                                                                                                                                                   |
| Reports              | Implemented and tested                                                   | Saves measurement snapshots and report details locally, supports an optional image and custom logo, and previews, downloads, or shares single and combined branded PDFs.                                                                                      |
| Tools                | WiFi bridge device-tested; Toner and Blinker physical validation pending | WiFi bridge sends device-compatible Ethernet and WiFi configuration commands. Toner and Blinker have complete controls, device command wiring, and synthetic protocol tests. Firmware version checking is implemented; firmware installation remains pending. |
| Settings             | Implemented                                                              | Global TIA, units, NVP, and Custom MAC settings are persisted and applied across measurements.                                                                                                                                                                |

## Known limitations

- [Web Bluetooth](https://caniuse.com/web-bluetooth) is not supported by every browser or platform; use desktop Chrome or Edge.
- Firmware checking is implemented, but firmware installation is not.
