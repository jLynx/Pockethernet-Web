import type { TestId } from '@/app/types';

export const TEST_HELP: Record<TestId, { description: string; note?: string }> = {
  wiremap: {
    description:
      'Connect the Pockethernet Wiremap Adapter to the far end of the cable run. The test checks every pin for correct wiring, opens, shorts, and crossed pairs.',
    note: 'Do not test against an Ethernet port; its termination can appear as short circuits.',
  },
  tdr: {
    description:
      'Connect Pockethernet to one end only. TDR estimates cable length and locates opens, shorts, or termination on each pair.',
    note: 'Disconnect active network equipment first. Its transmitted signals make TDR results invalid.',
  },
  'tdr-graph': {
    description:
      'Connect Pockethernet to one end only. Peaks show impedance changes along the cable; positive reflections suggest opens and negative reflections suggest shorts.',
    note: 'Values beyond about +/-20 can indicate a cable imperfection. Do not test an active port.',
  },
  ber: {
    description:
      'Attach the loopback adapter at the far end. Pockethernet links through the cable, sends data, and checks the returned packets for loss or CRC errors.',
    note: 'The manual specifies cable runs up to 50 m / 160 ft for this test.',
  },
  poe: {
    description:
      'Connect directly to the cable or port supplying power. The test detects active 802.3af/at/bt and passive PoE, then reports voltage, wiring mode, and available power class.',
  },
  link: {
    description:
      'Connect to the switch, router, or device under test. Pockethernet finds the highest advertised link speed and reports link capabilities and pair details.',
    note: 'The length shown here is only a rough estimate; use TDR for cable length and fault location.',
  },
  cdplldp: {
    description:
      'Pockethernet listens for CDP or LLDP announcements for the timeout chosen in Configure and reports details such as switch name, physical port ID, and management address.',
  },
  vlan: {
    description:
      'Listen for up to 30 seconds to discover VLAN tags seen on the port. Enable outgoing tagging to place Pockethernet DHCP, Ping, and External IP traffic on a specific VLAN.',
  },
  traffic: {
    description:
      'Observe traffic visible to Pockethernet on the connected port. Use this to confirm that the port is carrying packets before deeper network tests.',
  },
  ipv4: {
    description:
      'Request IPv4 settings from the network or enter static settings for later network tests. A DHCP request can take up to 30 seconds.',
  },
  ipv6: {
    description:
      'Check whether IPv6 SLAAC or DHCPv6 configuration is available. Pockethernet waits up to 30 seconds for the router advertisements needed to configure IPv6.',
  },
  extip: {
    description:
      'Verify Internet access and retrieve the connection’s public IP, provider, autonomous system, and approximate location using ip-api.com.',
  },
  ping: {
    description:
      'Ping up to three IP addresses or host names. Results include the resolved address and average time from three pings.',
    note: 'With no targets entered, Pockethernet uses the DHCP server, gateway, and DNS server.',
  },
};
