# Pocketweb feature goals for firmware 32

Firmware versions below refer to the Pockethernet ESP32. The existing v17
measurement paths and older saved reports are included in the regression checks.

| Goal                | Complete when                                                                                                                                                                                                                                               | Device verification                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Battery charging    | The connection control shows charging alongside a valid percentage, clears stale status when disconnected and handles unavailable F110 data.                                                                                                                | Compare unplugged, charging and full on v17 and v32.                                |
| Link diagnostics    | Live results and reports expose received signal quality by active pair and EEE advertised by the link partner. Old reports and short replies still render.                                                                                                  | Compare 100 Mbit/s and gigabit links and a partner offering EEE.                    |
| Report downloads    | Users can download selected saved reports as CSV or standalone structured JSON. Existing PDF, sort order and project filtering work as before.                                                                                                              | App only. Verify downloads and old reports.                                         |
| Measurement presets | Users can save, apply, rename, update and delete named test configurations. Presets survive a reload and respect the current workflow mode.                                                                                                                 | App only. Verify restored settings reach the next run.                              |
| Jobs and numbering  | Users can manage saved jobs, file and filter reports by job, and optionally advance an independent report number per job. Existing cable ID collision handling stays usable.                                                                                | App only. Verify reload, switching jobs and failed saves.                           |
| TDR                 | Compare two same-pair captures, use a third on disagreement and preserve a usable trace on a recoverable extra-capture failure. Use the legacy sign bits below v23 and repair legacy saturation below v31. Crosstalk uses the selected capture.             | Compare known cable lengths and NVP on v17 and v32.                                 |
| DHCP options        | Sending a vendor class requires v18. Show received option 60. Decode option 121 into destination/prefix and router and enable the official route path on v32. Legacy DHCP remains usable.                                                                   | Compare DHCP requests and replies from a server configured with options 60 and 121. |
| Captive portal      | On v18+, distinguish a portal redirect or intercepted successful response from an ordinary lookup failure. Display DHCP-advertised portal URLs. Keep legacy body-only lookup usable.                                                                        | Test open internet, redirects, inline login and provider errors.                    |
| Wi-Fi bridge        | Keep V17 bridge compatibility. Validate the passphrase, track Ethernet link, stop the bridge cleanly and avoid competing measurement writes.                                                                                                                | Enable, unplug/replug and disable on V17 and V32.                                   |
| Network Discovery   | Expose a user-started scan of the Pockethernet port with hosts, identity, passive segment observations, progress and partial results. Gate baseline discovery at v18 and newer protocol methods and PTP joins at v32. Carry the results into saved reports. | Compare hosts and segment observations on a known network with v32 hardware.        |
| Appearance          | System, light and dark still work and the new controls use existing theme colors.                                                                                                                                                                           | App only.                                                                           |

Use protocol fixtures for the cases above. A passing fixture confirms Pocketweb's
handling of the input. Accuracy, device behavior and interoperability require the
listed physical checks.

## Firmware and verification notes

- **v15** enables BER in the official Android app and Pocketweb.
- **v17** already supplies the charging state and extended Link data.
- **v18** enables Network Discovery, the DHCP vendor-class request, and HTTP
  response headers for captive-portal detection. Passive discovery can run
  without an IPv4 lease. Active discovery uses the configured IPv4 settings for
  the subnet on the Pockethernet port.
- **v23** enables the bridge UI in the official Android app. Pocketweb keeps
  the working V17 bridge path and checks Ethernet speed with the PHY status reply.
- **v23, v25 and v31** change TDR sign-bit decoding, oversized-reply reporting
  and saturation repair respectively.
- **v32** adds the advanced PROFINET, EtherNet/IP, BACnet, KNX, ONVIF, camera
  vendor and Art-Net discovery methods. The firmware also joins PTP multicast
  groups in segment mode and supports classless DHCP routes. Pocketweb looks up
  MAC assignments locally and retains unknown discovery records in saved JSON.
  Custom toner melodies require V32 in both apps. In Pocketweb, choose **Tools →
  Tone generator → Melody**, enter RTTTL text and turn the toner on. Pocketweb
  also matches the official app's 59-minute threshold for a likely V32 idle
  shutdown after an unexpected disconnect. Battery and device-info reads do not
  reset that timer. Verify melody playback and stopping, and check the idle
  message on a physical tester.
- **App-only** features include presets, jobs, exports and appearance. Presets
  are scoped to Single or Batch. A numbered job assigns its next available
  number as part of saving the report. The existing PDF layout includes new
  measurements and job information.

The offline checks cover packet parsing, discovery token matching and timeouts,
report storage migration and counter rollback, file generation and rendering.
The browser smoke test checked discovery controls and saved a preset. Validation
of the new firmware paths awaits a physical tester and the setups above. Use a
loopback dongle for BER, a disconnected known-length cable for TDR, and an active
Ethernet port for link partner and network tests.
