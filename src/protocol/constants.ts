// BLE identifiers recovered from the original Pockethernet 2 Android app.
export const BLE = Object.freeze({
  service: '0b7beb07-13fa-47b6-909e-a05daad11552',
  notify: 'c9eddcb6-04a5-4d58-abbe-a98da1b3f3d0',
  write: 'f63cdc3f-9652-460c-94b1-cc1afc117269',
});

export const PACKET = Object.freeze({
  DEVICE_INFO: 61700,
  DHCPV4_ACK: 62000,
  DHCPV6_ACK: 62001,
  SLAAC_ACK: 62002,
  WIREMAP: 61523,
  POE: 61520,
  PHY_LINKINFO: 61958,
  TDR_SAME: 61968,
  TDR_CROSS: 61969,
  ETH_CONFIG: 62016,
  ETH_FILTER_ADD: 62017,
  VLAN_COLLECT: 62020,
  WIFI_CONFIG: 62021,
  ETH_FILTER_MATCH: 62032,
  BER: 62022,
  PING: 62048,
  HTTP_RESPONSE: 62064,
  ANA_TONER: 61984,
  ETH_STOP: 62208,
  ACK: 61690,
  NACK: 61680,
});
