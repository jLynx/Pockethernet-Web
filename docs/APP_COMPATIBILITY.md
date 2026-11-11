# Browser compatibility audit and field retest

Audit date: 2026-11-11. Reference: Pockethernet 2 Android APK in `android-reference/com.pockethernet.android.pe2/`. This change updates Pocketweb, not either MCU firmware. The field report concerned stock firmware.

## Confirmed fixes

| Area               | Browser correction                                                                                                                                              | APK evidence                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Cable test order   | Wiremap → diagnostic Ethernet → TDR → cross-pair graph → PoE                                                                                                    | `pe_meas_pen._meas_sm` and numeric state initialization                                                     |
| Cable test failure | Wiremap/TDR/PoE timeouts mark that test as failed and continue; a same-pair/preparation failure skips cross-pair TDR                                            | `pe_meas_pen._timer_request_tick`                                                                           |
| PoE deadline       | 15 seconds in measurements                                                                                                                                      | `_meas_set_running_n_wait("poe", 15000)`; the builder's separate 10-second metadata is not this deadline    |
| No power           | A zero **raw** open-voltage short returns `not_OK`, `No PoE`, before mode classification                                                                        | `measdata_pen.smali`, method `_vvvvvvvvvv3`, lines 597–623                                                  |
| PoE polarity       | Read ADC words as unsigned, take absolute mode voltage differences, and use the APK's polarity orientation                                                      | Same smali method, lines 647–692                                                                            |
| PoE classification | Only AF/AT uses a 37 V minimum; AT, AT/BT and BT use 42 V. Imbalance requires both measured mode voltages above 10 V                                            | Same method, lines 785–812                                                                                  |
| Network setup      | One shared 10/100 Ethernet configuration preserves discovery, VLAN, IPv4 and IPv6 flags                                                                         | `protocol_pen._vvvvvvvvvvvvvvvv5`; `pe_meas_pen` states 50/52/60/70                                         |
| Async replies      | Register listeners before configuring Ethernet; record early replies; begin async deadlines after link/filter setup                                             | The APK handles incoming packets independently of its async timers                                          |
| DHCP/IPv6          | DHCPv4 and DHCPv6 each have 48 seconds; SLAAC has 30 seconds. A missing DHCPv6 reply retains a successful SLAAC result                                          | `_timer_dhcpv4`, `_timer_dhcpv6`, `_timer_slaac` and async packet handler                                   |
| Link negotiation   | Ignore link-down notifications while waiting for a link-up notification; 2 seconds for network/link ACK, then 10 seconds for link-up                            | States 40/42 and 50/52 and incoming handler                                                                 |
| IP prerequisites   | Ping/External IP initialize IPv4 even when selected alone. Empty ping slots use server, gateway and first DNS address. Individual ping timeouts continue        | `_check_ipv4_obtained`, `_ping_get_ip_target`, `_ping_request`, `_timer_request_tick`                       |
| BER                | A PHY notification during a BER batch fails the test and preserves previous batches                                                                             | `_meas_sm_incoming_handle`, BER state                                                                       |
| Ethernet cleanup   | Stop an Ethernet interface started by the run, after success or failure                                                                                         | `_abort_measurements`, also called at normal completion                                                     |
| CDP native VLAN    | Read TLV 10's two-byte value directly after its four-byte TLV header                                                                                            | `pparser_cdp`, native VLAN case                                                                             |
| LLDP encapsulation | Accept both Ethernet II and LLC/SNAP LLDP                                                                                                                       | `pparser_lldp` frame entry point                                                                            |
| IPv6 RA options    | Option length includes its two-byte header; advance by that length, retaining consecutive prefix/MTU/DNS options                                                | `pparser._vvvvvvvvvvvv6`                                                                                    |
| Device MAC         | Add 3 to the entire 48-bit MAC, with normal carries                                                                                                             | `measdata_pen._vv2` uses a big-endian long plus 3                                                           |
| WiFi security      | Use WPA/WPA2 PSK enum 4 for a password-protected bridge                                                                                                         | `ui_item_wifi`, enable branch                                                                               |
| Tool errors        | Await ACK for Blinker/Toner/WiFi writes so a rejected command cannot appear successful. Blinker setting changes also apply while it is active                   | `protocol_pen` command reply contracts; `ui_item_blinker` setting callbacks                                 |
| Blinker timing     | Set the manual Ethernet timing word at payload offset 10 to 10; enable auto-negotiation only when speed or duplex is Auto                                       | `protocol_pen.smali`, `_vvvvvvvvvvvvvvvv3`, source lines 442 and 466; the Java decompiler skips this method |
| Report comments    | Give notes the full metadata width, expand the border and move measurements down; continue very long notes on extra pages                                       | PDF regression tests for wrapped notes, 200 explicit lines, page bounds and multi-report exports            |
| Display            | Failed tests show their failure instead of `Not measured`; clear selected old results before starting. Async network panels indicate which tests remain pending | Browser regression requirement; no valid measurements are fabricated for failed tests                       |

## Refactor contracts

1. Use **numeric APK states**, not Java switch-case listing order. Ping states 81/82/84/88 run before External IP state 90. The decompiled switch lists External IP first, which is misleading.
2. TDR Graph always needs a fresh same-pair measurement even when the separate TDR switch is off. If cross-pair measurement fails, retain the same-pair result and fail only the graph.
3. Preserve the existing same-pair `[3,3,0,0,189,64,8,3]`, cross-pair `[3,4,0,0,189,64,8,2]`, and diagnostic configuration flags 9/PHY 0. The APK's diagnostic and link-test configurations do not apply the custom MAC; the shared network setup does.
4. Do not turn a timeout, NACK, malformed packet or Bluetooth disconnect into a synthetic positive measurement. Device timeouts/rejections can advance independent cable/IP tests; connection/write failures and network link setup failures abort.
5. `No PoE` is a valid negative measurement, distinct from no reply. Test the raw signed voltage short at offset 4 **before** dividing or rounding: a nonzero raw value can round to 0 V.
6. ADC words at offsets 16–22 are unsigned. Pair supply voltages at offsets 24–30 and open/load voltages at 4/6 are signed tenths of volts. The ADC difference scale is `0.002393809`, stored as a float in the APK.
7. F244 VLAN collection words are little-endian. Ethernet frame TCIs and CDP native-VLAN values are network order. Do not share one byte-order helper for all three.
8. Async DHCP/SLAAC/filter replies can arrive before the ETH_CONFIG ACK. Listen first. Multiple filter collectors must receive the same frame; a passive waiter must not consume a command's NACK.
9. Cancelling a run/connection must remove listeners and deadlines. A failed write must remove its response waiter, otherwise it can steal a later reply. The tests exercise the actual production packet inbox.
10. Keep async deadlines independent: discovery/VLAN/traffic/SLAAC 30 seconds; DHCPv4/DHCPv6 48 seconds. Retain whichever IPv6 protocols answered. Link-down during negotiation is different from link change during BER.
11. Stop Ethernet only when this run attempted to start it. Report cleanup failures separately without erasing the original error. A PoE-only or wiremap-only run does not need ETH_STOP.
12. Settings such as VLAN tagging, custom MAC and static IPv4 must survive the shared configuration. Do not recreate the previous per-test configuration sequence, which overwrote other tests' state.
13. Empty ping slots have per-slot defaults, rather than being removed from the list. Do not announce zero servers as successful. Missing IPv4 prevents IP requests but does not prevent BER.
14. Clear selected results at run start. Never attach an older cross-pair graph to a fresh TDR trace or show old selected results after an early abort.
15. Browser features intentionally extend the APK in some places: configurable WiFi credentials, auto-initialization of IPv4 prerequisites, custom v16 firmware BER support, and truthful partial IPv6 display. These must not be mistaken for evidence of literal APK UI equivalence.
16. The packet format does not carry a request sequence ID. A late reply of the **same type** during a later identical request cannot always be distinguished. Cancellation prevents abandoned listeners from stealing replies, but does not prove every same-type late-reply race is solved. Avoid overlapping runs and include repeated runs in hardware testing.
17. The APK's link **display** parser tests bit 64 for 100 Mbit after its link-up check, while its separate link-speed helper uses bit 256. The browser retains the APK display behavior; do not silently normalize this while claiming exact app-result parity.

## Automated checks

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

- `src/app/runMeasurements.test.ts`: all 16 cable selections; every cable-stage timeout; NACK/disconnect; shared network flags; notifications before ACK; IPv6 partial response; IP-only selection; default ping slots; ping timeout continuation; missing DHCP; link/NACK abort and cancellation; BER totals/link loss.
- `src/device/packetInbox.test.ts`: NACK routing; a reply at 14.999 seconds; timeout and late packets; concurrent collectors; deferred deadlines; link-up filtering; immediate replies; failed writes; disconnect cancellation.
- `src/protocol/appParity.test.ts`: no-PoE modes and raw rounding boundary; PoE polarity/unsigned ADC/imbalance/AT threshold; MAC overflow; combined network flags/static addresses; CDP VLAN; SNAP LLDP; consecutive RA options and truncated headers.
- `src/features/measurements/measurementDisplay.test.ts`: failed-panel status and negative PoE presentation.
- Existing protocol, notification, PWA asset recovery and firmware-server tests remain in the gate.

These are offline tests using deterministic packets and the real browser orchestration/inbox/parsers. They do not certify relay timing, analog accuracy, positive PoE behavior, RF reliability or MCU firmware parity.

## Field retest before claiming the report is resolved

After deploying this build, close old Pocketweb tabs/PWA windows and reopen or reload until the updated version is active. Keep the official app disconnected while Pocketweb is connected.

- [ ] Repeat the video's setup: supplied patch cable and wiremap adapter; select Wiremap, TDR, TDR Graph, PoE. Expect wiremap first, TDR/graph next, then `No PoE` where no power is supplied.
- [ ] Run TDR alone and TDR Graph alone. Compare all four pair distances, termination classifications and graph traces with a fresh official-app measurement using the same cable, adapter and NVP.
- [ ] Run PoE alone with no power. It should return `No PoE`, not successful passive 0 V. If it times out, record elapsed time and whether any response was received; the timeout and negative result are separate paths.
- [ ] On a known PoE source, compare type, class, open/load voltage, both polarity modes and pair supply voltages with the official app. This was not demonstrated by the supplied video.
- [ ] Repeat the combined cable run at least five times, then disconnect/reconnect and repeat. Check that no old graph/results survive a failed run. Record relay sound with audio if a comparison is needed.
- [ ] On a switch port, combine Link, CDP/LLDP, VLAN, Traffic, IPv4 and IPv6. Confirm shared VLAN/custom MAC configuration, IPv6 partial results where one service is unavailable, and successful Ping/External IP afterward.
- [ ] Test Ping and External IP individually, including blank default ping targets and a nonresponding target. Confirm later targets/tests still finish.
- [ ] Recheck BER with loopback, including live link removal and repeated batches; confirm failed/partial status and recovery on the next run.
- [ ] Check Blinker speed/duplex/MDI changes while active, Toner pair/tone changes while active, and WiFi bridge enable/disable. Confirm rejected commands leave an error rather than a false successful control state.

The supplied video has no audio stream. Its web failure occurs at PoE, before the previous browser flow ever requests TDR; the video therefore does not establish a TDR decoder/hardware failure. The original cause of the missing PoE response still needs stock hardware timing/packet evidence.

## Audit limits / remaining differences

- This audit covers measurement orchestration, the exported device command builders, packet reply handling and the touched parsers/tool actions. It is not an exhaustive equivalence proof for all APK screens and network packet variants.
- CDP/LLDP parsers still expose fewer optional/vendor-specific TLV fields than the APK (for example LLDP-MED and some organization-specific power/policy fields). Basic discovery and VLAN offset/encapsulation corrections are covered here; full optional-TLV field parity remains pending.
- Positive PoE, calibrated TDR, toner output and wider network/physical fault fixtures still need direct comparison. No firmware was flashed and the live website was not deployed by this local change.
