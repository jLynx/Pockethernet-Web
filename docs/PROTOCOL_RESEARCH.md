# Protocol Research

This document records the technical research used to make Pocketweb for Pockethernet compatible with Pockethernet 2 hardware. The original first-generation Pockethernet is not currently supported, but support may be considered if there is enough community interest. This document is intended for maintainers working on the BLE transport, packet formats, parsers, and measurement behavior.

Pocketweb for Pockethernet is an independent implementation. Its React interface, application architecture, browser workflows, reporting system, and visual design were developed for this project. Existing software was consulted only where needed to understand the hardware protocol and expected measurement behavior, alongside physical device testing and public networking standards.

## Reference material

The repository includes an extracted Android application for technical reference at:

```text
android-reference/com.pockethernet.android.pe2
```

Useful locations within that directory:

| Folder                                  | Purpose                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `java_src/com/pockethernet/android/pe2` | Decompiled Java that can help identify packet structures and measurement sequences.          |
| `smali/com/pockethernet/android/pe2`    | Bytecode used to verify behavior when decompiled Java is incomplete or ambiguous.            |
| `res`                                   | Android resources that can clarify labels, defaults, units, and expected measurement states. |
| `assets`                                | Assets bundled with the Android application.                                                 |
| `AndroidManifest.xml`                   | Android application metadata and permissions.                                                |

The most relevant Java files include:

- `protocol.java`, `protocol_pep.java`, and `protocol_pen.java` for packet definitions and protocol behavior
- `protocol_cobs.java` for message framing
- `pe_ble.java` for BLE transport and UUID behavior
- `pe_meas_pen.java` for measurement orchestration
- `measdata_pen_wiremap.java` and `measdata_pen_tdr.java` for cable measurement state
- `pparser_cdp.java`, `pparser_lldp.java`, and `pparser_dhcp.java` for network packet parsing

When decompiled Java is incomplete or suspicious, verify the corresponding Smali instead of inferring missing behavior.

## Packet IDs

| Name               | Decimal ID | Current use                                            |
| ------------------ | ---------: | ------------------------------------------------------ |
| `WIREMAP`          |    `61523` | Wiremap command and response                           |
| `POE`              |    `61520` | PoE command and response                               |
| `DEVICE_INFO`      |    `61700` | Device information request and response                |
| `TDR_SAME`         |    `61968` | Four-pair TDR traces                                   |
| `TDR_CROSS`        |    `61969` | Six crosstalk traces used by TDR Graph                 |
| `ETH_CONFIG`       |    `62016` | Ethernet interface configuration                       |
| `ETH_FILTER_ADD`   |    `62017` | Ethernet filter configuration                          |
| `VLAN_COLLECT`     |    `62020` | Asynchronous incoming VLAN tag collection              |
| `DHCPV4_ACK`       |    `62000` | Asynchronous DHCPv4 completion before network requests |
| `PING`             |    `62048` | Ping request and response                              |
| `HTTP_RESPONSE`    |    `62064` | Device-side External IP HTTP response                  |
| `ACK`              |    `61690` | Successful command acknowledgement                     |
| `ETH_FILTER_MATCH` |    `62032` | Asynchronous filtered Ethernet frame                   |
| `NACK`             |    `61680` | Rejected command response                              |

Packet IDs alone are not sufficient to implement a feature. Record payload structure, byte order, prerequisites, response types, timing, units, thresholds, and state transitions.

## Implementation workflow

1. Establish expected behavior through physical device testing and applicable public standards.
2. Identify the relevant packet sequence, payload fields, response types, and timing constraints.
3. Use the technical reference only where observed behavior does not provide enough protocol detail.
4. Add command builders and pure response parsers under `src/protocol`.
5. Add synthetic protocol tests and captured-packet fixtures where available.
6. Connect the feature through `src/app/runMeasurements.ts` and clear stale state before each run or disconnect.
7. Do not display a successful result until valid device data has been received.
8. Validate the complete workflow against physical hardware and retain raw responses for discrepancies.
9. Design the browser interaction and presentation around the web app's own UX rather than reproducing the native interface.

## TDR notes

The TDR measurement sequence is:

1. Send `ETH_CONFIG` (`62016`) with a 53-byte payload and interface flags `9` (`UP + KEEP_LINK_UP`).
2. Wait for `ACK` (`61690`).
3. Send `TDR_SAME` (`61968`) with eight signed little-endian 16-bit values:

   ```text
   [3, 3, 0, 0, 189, 64, 8, 3]
   ```

4. Decompress the returned trace and split it into four equal pair traces.
5. Apply peak detection and NVP distance calculations. The current default NVP is `71`.

The display order is pairs `2, 3, 1, 4`. Results are classified as `Open`, `Short`, or `Terminated`. A result becomes `Mixed results` when pair statuses differ or their distance spread is greater than 1.5 metres.
