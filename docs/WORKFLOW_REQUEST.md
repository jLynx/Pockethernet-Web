# Batch testing workflow (issue #6)

The navigation is **Test → Configure → Reports → Tools → Settings**. A persistent **Single test / Batch testing** selector keeps both workflows available. Tools contains Tone generator, WiFi bridge, and Blink port light. Settings contains appearance, notifications, device information/firmware, and application reset.

## Single test and batch workflows

**Single test** restores all selectable test cards and their network, Ping, discovery and BER controls on Test. Cable and report defaults are available in Configure. Reports contains the composer for saving the latest measurement run, with an optional Tag and the shared saved library. Subsequent runs keep other test results visible for troubleshooting; each saved report contains only the latest run, identified explicitly in the composer.

**Batch testing** keeps test selection and all test/report defaults in Configure. Enter the Cable ID, measure, review, add notes or photos, and save or Save & next from Test. Reports manages the library and PDF exports.

Each workflow retains its own selection, cable/network configuration, Ping settings and report details. The first single-test configuration starts from existing preferences, then changes are saved separately. Existing batch settings retain their original storage keys. New users and users upgrading from the original interface start in Single test; users already using the batch selection retain Batch testing. The mode choice persists across reloads.

Switching modes keeps each workflow's pending results, draft and photos in memory. Mode changes are disabled during measurements, photo processing, storage/device operations or firmware work. Saved reports, branding, device tools and app preferences are shared. Unsaved results and photos remain session data and should be saved before reloading.

## Implemented behavior

- Configure groups test selection, wiremap acceptance, TIA/NVP/units, network configuration, Ping targets/defaults, discovery timeout, BER, project defaults, numbering, decimal formatting, and branding. General app/device controls are kept in Settings.
- Static IPv4 fields stack vertically and use the available width. Discovery can be excluded from test selection or configured for 10, 30, or 60 seconds.
- Each report captures only its own measurement run, including the selected tests, settings used, actual start/end timestamps, failures, and partial results. Failed or interrupted runs can be saved. In Batch testing, starting another measurement prompts before replacing unsaved results.
- Cable IDs are required for new batch reports; Single test reports allow an optional Tag. With auto increment enabled, Save & next requires a numeric suffix, preserves padding (`CAB-009 → CAB-010`), and skips IDs already saved for the same project and site. Normal Save does not advance the ID. Save & next advances only after storage succeeds and clears cable-specific notes, photos, and Port ID.
- Duplicate Cable IDs prompt to save as a retest while retaining the earlier reports. Matching ignores case and surrounding whitespace and includes project and site.
- Wiremap acceptance supports optional shield continuity, crossover acceptance, and two-pair or four-pair wiring requirements. Raw measured pin connections are retained. These rules do not certify an Ethernet speed.
- Changing the project filter clears the report selection; combined PDF exports include only selected visible reports.
- Reset deletes this browser's application reports, migration backups, and preferences after confirmation. It is blocked while measurements, report/photo operations, migration, or firmware/device commands are active.

## Existing data and storage

Saved reports now use IndexedDB (`pockethernet-reports`, version 2). On first load, the application imports the existing `pockethernet.reports` localStorage value, including results, site metadata, single-photo reports, multiple photos, and image descriptions.

The original JSON and existing `pockethernet.*` preferences are copied into the `migrationBackups` store in the same transaction as the import. Existing IndexedDB report IDs are not overwritten. The legacy report value is removed only after that transaction commits, every original record is recognized, and an older tab has not changed the value. A failed transaction leaves the source intact; unrecognized records retain their original source and recovery copy and produce a storage notice.

Preferences continue to use localStorage for synchronous startup and firmware recovery and retain their existing values. Report photos are stored with reports in IndexedDB; no report data is uploaded. Browser storage remains specific to its browser profile and site origin.

An unchanged recovery source is imported once, so retained unreadable data does not restore subsequently deleted reports. If migration fails, recognized legacy reports remain available for viewing and PDF export; saving and deletion stay disabled until storage opens successfully.

## Decisions still needed

1. **Speed-labelled limits:** decide whether a limit means required wiring, negotiated link speed, or cable qualification. The manual describes actual links up to 1 Gbit/s and advertised capability detection up to 10 Gbit/s; higher-speed qualification cannot be inferred from a wiremap or advertisement.
2. **Auto shutoff:** define browser idle disconnect versus physical device power-off, what resets the five-minute timer, and behavior during tests, tools, and firmware updates. Physical power control needs hardware validation.
3. **Date/time overrides:** define whether this changes report metadata or the device clock, timezone handling, and whether a manual value applies to one report or remains an offset. Actual measurement timestamps are implemented.
4. **Languages:** select supported languages/regions, a translation/review process, and PDF font coverage.
5. **Speedtest:** define LAN versus Internet testing, endpoint, upload/download behavior, duration, and firmware/hardware support.

## Validation

Synthetic tests cover migration, rollback, concurrent legacy writes, report snapshots, partial failures, numbering, duplicate scopes, acceptance rules, and formatting. Browser previews cover navigation, persistence, mobile static-IP layout, Save & next, occupied-ID skipping, and storage-failure retry. Physical testing with Pockethernet remains required for the changed workflow and acceptance settings.
