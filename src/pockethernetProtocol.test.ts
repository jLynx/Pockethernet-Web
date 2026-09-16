import assert from 'node:assert/strict';
import {
  PACKET,
  berCommand,
  berEthernetCommand,
  blinkerCommand,
  cdpLldpCommand,
  externalIpCommand,
  externalIpEthernetCommand,
  ipv4EthernetCommand,
  decompressTdr,
  diagnosticEthernetCommand,
  isBerLinkUp,
  linkCommand,
  parseLinkPacket,
  parsePoePacket,
  parseVlanPacket,
  parseBerPacket,
  parseCdpLldpPacket,
  parseExternalIpPacket,
  parseFirmwareVersionResponse,
  parseIpv4Packet,
  parseDeviceInfo,
  parsePingPacket,
  parseTrafficPacket,
  poeCommand,
  parseTdrCrosstalkPacket,
  parseTdrPacket,
  tdrCommand,
  tdrCrosstalkCommand,
  tdrSampleDistance,
  tonerCommand,
  tonerStopCommand,
  trafficEthernetCommand,
  trafficFilterCommand,
  wifiBridgeCommand,
  wifiBridgeEthernetCommand,
  vlanEthernetCommand,
  pingCommand,
} from './pockethernetProtocol';
function encodeSamples(samples: number[]): Uint8Array {
  const payload = new Uint8Array(samples.length * 2);
  const view = new DataView(payload.buffer);
  samples.forEach((sample, index) => {
    const word = Math.abs(sample) | (sample < 0 ? 0x100 : 0);
    view.setUint16(index * 2, word, true);
  });
  return payload;
}
const openPair = [...Array<number>(40).fill(0), 1, 5, 20, 5, 0];
const openPayload = encodeSamples([...openPair, ...openPair, ...openPair, ...openPair]);
assert.deepEqual(decompressTdr(encodeSamples([3, -5, 0])), [3, -5, 0]);
const open = parseTdrPacket(openPayload);
assert.equal(open.status, 'OK');
assert.equal(open.summary, 'Open @ 4.3 m');
assert.deepEqual(
  open.pairs.map((pair) => pair.status),
  ['Open', 'Open', 'Open', 'Open'],
);
const shortPair = [...Array<number>(40).fill(0), -1, -5, -20, -5, 0];
const shortPayload = encodeSamples([...shortPair, ...shortPair, ...shortPair, ...shortPair]);
assert.equal(parseTdrPacket(shortPayload).summary, 'Short @ 4.3 m');
const diagnostic = diagnosticEthernetCommand();
assert.equal(diagnostic.type, PACKET.ETH_CONFIG);
assert.equal(diagnostic.payload.length, 53);
assert.equal(new DataView(diagnostic.payload.buffer).getUint16(0, true), 9);
assert.equal(tdrCommand().payload.length, 16);
assert.deepEqual(
  Array.from({ length: 8 }, (_, index) =>
    new DataView(tdrCommand().payload.buffer).getInt16(index * 2, true),
  ),
  [3, 3, 0, 0, 189, 64, 8, 3],
);

const crossCommand = tdrCrosstalkCommand();
assert.equal(crossCommand.type, PACKET.TDR_CROSS);
assert.deepEqual(
  Array.from({ length: 8 }, (_, index) =>
    new DataView(crossCommand.payload.buffer).getInt16(index * 2, true),
  ),
  [3, 4, 0, 0, 189, 64, 8, 2],
);

const cross = parseTdrCrosstalkPacket(encodeSamples([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
assert.equal(cross.traces.length, 6);
assert.deepEqual(cross.traces, [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 12],
]);
assert.equal(Number(tdrSampleDistance(32).toFixed(1)), -0.3);

const berConfig = berEthernetCommand(1000);
const berConfigView = new DataView(berConfig.payload.buffer);
assert.equal(berConfig.type, PACKET.ETH_CONFIG);
assert.equal(berConfig.payload.length, 53);
assert.equal(berConfigView.getUint16(0, true), 9);
assert.equal(berConfigView.getUint32(4, true), 83763);
assert.equal(berConfigView.getUint16(10, true), 10);

const ber = berCommand(1500, '55');
const berView = new DataView(ber.payload.buffer);
assert.equal(ber.type, PACKET.BER);
assert.equal(berView.getUint32(0, true), 10000);
assert.equal(berView.getUint16(4, true), 1500);
assert.equal(berView.getUint16(6, true), 12);
assert.equal(ber.payload[8], 4);

const berResponse = new Uint8Array(12);
const berResponseView = new DataView(berResponse.buffer);
berResponseView.setUint32(0, 10000, true);
berResponseView.setUint32(4, 9998, true);
berResponseView.setUint32(8, 1, true);
const berResult = parseBerPacket(berResponse);
assert.equal(berResult.errorRate, '300.0 ppm');
const accumulatedBer = parseBerPacket(berResponse, berResult);
assert.equal(accumulatedBer.sent, 20000);
assert.equal(accumulatedBer.errorRate, '300.0 ppm');
const linkResponse = new Uint8Array(12);
new DataView(linkResponse.buffer).setUint16(10, 64 | 512, true);
assert.equal(isBerLinkUp(linkResponse), true);

const poeResponse = new Uint8Array(32);
const poeView = new DataView(poeResponse.buffer);
poeResponse[2] = 0;
poeView.setInt16(4, 480, true);
poeView.setInt16(6, 470, true);
poeView.setInt16(16, 5000, true);
poeView.setInt16(18, -5000, true);
poeView.setInt16(24, 120, true);
const passivePoe = parsePoePacket(poeResponse);
assert.equal(poeCommand().type, PACKET.POE);
assert.equal(poeCommand().payload.length, 0);
assert.equal(passivePoe.poeType, 'Passive / Nonstandard');
assert.equal(passivePoe.openVoltage, 48);
assert.equal(passivePoe.loadVoltage, 47);
assert.equal(passivePoe.pairVoltages[0], 12);
assert.equal(passivePoe.status, 'OK');

const afAtResponse = new Uint8Array(32);
const afAtView = new DataView(afAtResponse.buffer);
afAtResponse[0] = 1;
afAtResponse[1] = 1;
afAtResponse[2] = 20;
afAtView.setInt16(4, 480, true);
afAtView.setInt16(6, 470, true);
assert.equal(parsePoePacket(afAtResponse).poeType, 'AF/AT');

const linkCommandValue = linkCommand();
const linkCommandView = new DataView(linkCommandValue.payload.buffer);
assert.equal(linkCommandValue.type, PACKET.ETH_CONFIG);
assert.equal(linkCommandView.getUint16(0, true), 129);
assert.equal(linkCommandView.getUint32(4, true), 67565);
const customMacLink = linkCommand('00:11:22:33:44:55');
assert.deepEqual(Array.from(customMacLink.payload.slice(14, 20)), [0, 17, 34, 51, 68, 85]);
assert.throws(() => linkCommand('invalid-mac'), /Invalid custom MAC address/);
const blinkerOn = blinkerCommand('100', 'full', 'mdi', 'on');
const blinkerOnView = new DataView(blinkerOn.payload.buffer);
assert.equal(blinkerOn.type, PACKET.ETH_CONFIG);
assert.equal(blinkerOnView.getUint16(0, true), 9);
assert.equal(blinkerOnView.getUint32(4, true), 1 | 128 | 1024 | 4 | 32 | 65536);
const blinkerBlink = blinkerCommand('auto', 'auto', 'auto', 'blink');
assert.equal(new DataView(blinkerBlink.payload.buffer).getUint16(0, true), 25);
assert.equal(blinkerCommand('auto', 'auto', 'auto', 'off').type, PACKET.ETH_STOP);
const toner = tonerCommand('all', 'on', '2', 'low');
const tonerView = new DataView(toner.payload.buffer);
assert.equal(toner.type, PACKET.ANA_TONER);
assert.equal(toner.payload.length, 20);
assert.equal(tonerView.getInt32(0, true), 31);
assert.equal(tonerView.getInt32(4, true), 1);
assert.deepEqual(
  [tonerView.getInt32(8, true), tonerView.getInt32(12, true), tonerView.getInt32(16, true)],
  [400, 700, 150],
);
assert.equal(tonerStopCommand().payload.length, 4);
const wifiEthernet = wifiBridgeEthernetCommand();
const wifiEthernetView = new DataView(wifiEthernet.payload.buffer);
assert.equal(wifiEthernet.type, PACKET.ETH_CONFIG);
assert.equal(wifiEthernetView.getUint16(0, true), 11);
assert.equal(wifiEthernetView.getUint32(4, true), 1645);
const wifi = wifiBridgeCommand(true, 'Test WiFi', 'secret');
const wifiView = new DataView(wifi.payload.buffer);
assert.equal(wifi.type, PACKET.WIFI_CONFIG);
assert.equal(wifi.payload.length, 144);
assert.equal(wifiView.getUint16(0, true), 3);
assert.equal(wifi.payload[36], 9);
assert.equal(wifi.payload[37], 6);
assert.equal(wifi.payload[38], 1);
assert.equal(wifi.payload[39], 3);
assert.deepEqual(
  Array.from(wifi.payload.slice(40, 46)),
  Array.from(new TextEncoder().encode('secret')),
);
assert.equal(new DataView(wifiBridgeCommand(false).payload.buffer).getUint16(0, true), 0);
const linkPacket = new Uint8Array(30);
const linkPacketView = new DataView(linkPacket.buffer);
linkPacketView.setUint16(4, (2 << 5) | (2 << 7), true);
linkPacketView.setUint16(8, 2 << 10, true);
linkPacketView.setUint16(10, 64 | 128 | 512, true);
linkPacketView.setUint16(12, 1024, true);
linkPacketView.setUint16(26, 3 | (2 << 3), true);
linkPacketView.setInt16(28, 42, true);
const linkResult = parseLinkPacket(linkPacket);
assert.equal(linkResult.summary, 'Link Up, 1000 Mbit, Full duplex');
assert.equal(linkResult.linkUp, true);
if (!linkResult.linkUp) throw new Error('Expected the fixture link to be up');
assert.equal(linkResult.partnerCapabilities['1000M'], 'Full Duplex');
assert.equal(linkResult.polarity[0], 'Inverted');
assert.deepEqual(linkResult.skewDelay, [24, 16, 0, 0]);
assert.equal(linkResult.lengthEstimate, 42);

const cdpCommandValue = cdpLldpCommand();
const cdpCommandView = new DataView(cdpCommandValue.payload.buffer);
assert.equal(cdpCommandValue.type, PACKET.ETH_CONFIG);
assert.equal(cdpCommandView.getUint16(0, true), 105);
assert.equal(cdpCommandView.getUint32(4, true), 1773);
const vlanCommandValue = vlanEthernetCommand();
const vlanCommandView = new DataView(vlanCommandValue.payload.buffer);
assert.equal(vlanCommandValue.type, PACKET.ETH_CONFIG);
assert.equal(vlanCommandView.getUint16(0, true), 265);
assert.equal(vlanCommandView.getUint32(4, true), 1901);
const vlanTaggingCommand = vlanEthernetCommand(200);
assert.equal(new DataView(vlanTaggingCommand.payload.buffer).getUint16(8, true), 200);
assert.deepEqual(parseVlanPacket(new Uint8Array([0, 0, 0xb0, 100, 0x10, 100])), [
  { id: 100, priority: 0, dei: true },
  { id: 100, priority: 5, dei: true },
]);
const trafficConfig = trafficEthernetCommand();
const trafficConfigView = new DataView(trafficConfig.payload.buffer);
assert.equal(trafficConfig.type, PACKET.ETH_CONFIG);
assert.equal(trafficConfigView.getUint16(0, true), 9);
assert.equal(trafficConfigView.getUint16(2, true), 3);
assert.equal(trafficConfigView.getUint32(4, true), 1773);
const trafficFilter = trafficFilterCommand();
assert.equal(trafficFilter.type, PACKET.ETH_FILTER_ADD);
assert.equal(trafficFilter.payload.length, 32);
assert.equal(trafficFilter.payload[5], 1);
const ethernetFrame = new Uint8Array([0, 17, 34, 51, 68, 85, 102, 119, 136, 153, 170, 187, 8, 0]);
assert.deepEqual(parseTrafficPacket(ethernetFrame), {
  source: '66:77:88:99:AA:BB',
  destination: '00:11:22:33:44:55',
  vlanId: '',
});
const vlanFrame = new Uint8Array([...ethernetFrame.slice(0, 12), 0x81, 0x00, 0xa0, 0x64, 8, 0]);
assert.deepEqual(parseTrafficPacket(vlanFrame), {
  source: '66:77:88:99:AA:BB',
  destination: '00:11:22:33:44:55',
  vlanId: '100',
});
assert.deepEqual(parseTrafficPacket(vlanFrame.slice(0, 16)), {
  source: '66:77:88:99:AA:BB',
  destination: '00:11:22:33:44:55',
  vlanId: '100',
});
assert.throws(() => parseTrafficPacket(new Uint8Array(13)), /Invalid Traffic Ethernet frame/);
const extipConfig = externalIpEthernetCommand();
const extipConfigView = new DataView(extipConfig.payload.buffer);
assert.equal(extipConfigView.getUint16(0, true), 9);
assert.equal(extipConfigView.getUint16(2, true), 3);
assert.equal(extipConfigView.getUint32(4, true), 1773);
const extipRequest = externalIpCommand();
assert.equal(extipRequest.type, PACKET.HTTP_RESPONSE);
assert.equal(new DataView(extipRequest.payload.buffer).getUint16(0, true), 10000);
assert.equal(
  parseExternalIpPacket(
    new TextEncoder().encode(
      '{"status":"success","query":"198.51.100.7","as":"AS64500","isp":"Example ISP","city":"Test City","region":"Test Region","country":"ZZ"}',
    ),
  ).fields['Geo IP'],
  'Test City, Test Region, ZZ',
);
const ipv4Config = ipv4EthernetCommand('dhcp');
const ipv4ConfigView = new DataView(ipv4Config.payload.buffer);
assert.equal(ipv4ConfigView.getUint16(2, true), 3);
const deviceInfoPayload = new Uint8Array(35);
const deviceInfoView = new DataView(deviceInfoPayload.buffer);
deviceInfoView.setInt32(0, 12345, true);
deviceInfoView.setInt32(12, 7, true);
deviceInfoView.setInt32(24, 18, true);
deviceInfoPayload.set([0x00, 0x11, 0x22, 0x33, 0x44, 0x50], 29);
assert.deepEqual(parseDeviceInfo(deviceInfoPayload), {
  serial: 12345,
  hardwareVersion: 0,
  stmVersion: 7,
  espVersion: 18,
  mac: '00:11:22:33:44:53',
});
assert.deepEqual(parseFirmwareVersionResponse('19#https://ota.pockethernet.com/firmware.bin', 18), {
  latestVersion: 19,
  downloadUrl: 'https://ota.pockethernet.com/firmware.bin',
  updateAvailable: true,
  message: 'Update available: v19',
});
assert.equal(
  parseFirmwareVersionResponse('18#https://ota.pockethernet.com/firmware.bin', 18).updateAvailable,
  false,
);
assert.throws(
  () => parseFirmwareVersionResponse('invalid', 18),
  /Invalid response from update server/,
);
const pingRequest = pingCommand('example.com');
const pingRequestView = new DataView(pingRequest.payload.buffer);
assert.equal(pingRequest.type, PACKET.PING);
assert.equal(pingRequest.payload.length, 'example.com'.length + 13);
assert.equal(pingRequestView.getUint16(0, true), 100);
assert.equal(pingRequestView.getUint16(2, true), 500);
assert.equal(pingRequestView.getUint16(4, true), 64);
assert.equal(pingRequestView.getUint16(6, true), 2000);
assert.deepEqual(Array.from(pingRequest.payload.slice(8, 12)), [3, 0, 255, 0]);
assert.equal(pingRequest.payload[pingRequest.payload.length - 1], 0);
const pingResponse = new Uint8Array(16);
const pingResponseView = new DataView(pingResponse.buffer);
pingResponseView.setUint16(6, 23, true);
pingResponse[11] = 0;
pingResponse.set([192, 0, 2, 1], 12);
assert.deepEqual(parsePingPacket(pingResponse), { status: 'OK', ip: '192.0.2.1', time: '23 ms' });
const dhcpFrame = new Uint8Array(14 + 20 + 8 + 300);
dhcpFrame.set([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x08, 0x00]);
dhcpFrame[14] = 0x45;
dhcpFrame[14 + 9] = 17;
dhcpFrame.set([192, 0, 2, 10], 14 + 12);
const dhcpView = new DataView(dhcpFrame.buffer);
const dhcpStart = 42;
dhcpView.setUint32(dhcpStart + 16, 0xc000020a, false);
dhcpView.setUint32(dhcpStart + 236, 0x63825363, false);
let optionOffset = dhcpStart + 240;
const writeOption = (type: number, bytes: Uint8Array): void => {
  dhcpFrame[optionOffset++] = type;
  dhcpFrame[optionOffset++] = bytes.length;
  dhcpFrame.set(bytes, optionOffset);
  optionOffset += bytes.length;
};
writeOption(1, new Uint8Array([255, 255, 255, 0]));
writeOption(3, new Uint8Array([192, 0, 2, 1]));
writeOption(6, new Uint8Array([192, 0, 2, 53]));
writeOption(51, new Uint8Array([0, 0, 0, 120]));
dhcpFrame[optionOffset] = 255;
const ipv4Result = parseIpv4Packet(dhcpFrame);
assert.equal(ipv4Result.fields['Your IP'], '192.0.2.10');
assert.equal(ipv4Result.fields['Subnet Mask'], '255.255.255.0');
assert.equal(ipv4Result.fields.Gateway, '192.0.2.1');
assert.equal(ipv4Result.fields['DNS Servers'], '192.0.2.53');
assert.equal(ipv4Result.fields['IP lease time'], '2 min');
const cdpFrame = new Uint8Array([
  1, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 3, 0, 0, 0xaa, 0xaa, 3, 0, 0, 12, 0x20, 0, 2, 180, 0, 0, 0, 1, 0,
  8, 100, 101, 118, 49, 0, 3, 0, 5, 49, 0, 0, 0,
]);
const cdpResult = parseCdpLldpPacket(cdpFrame);
assert.equal(cdpResult.protocol, 'CDP');
assert.equal(cdpResult.fields['Device ID'], 'dev1');
assert.equal(cdpResult.fields['Port ID'], '1');

const lldpFrame = new Uint8Array(44);
lldpFrame[0] = 1;
lldpFrame[5] = 14;
lldpFrame[6] = 0xe0;
lldpFrame[7] = 0x63;
lldpFrame[8] = 0xda;
lldpFrame[9] = 0x55;
lldpFrame[10] = 0x0a;
lldpFrame[11] = 0x6f;
lldpFrame[12] = 0x88;
lldpFrame[13] = 0xcc;
let lldpCursor = 14;
const writeLldp = (type: number, bytes: Uint8Array): void => {
  const header = (type << 9) | bytes.length;
  lldpFrame[lldpCursor++] = header >>> 8;
  lldpFrame[lldpCursor++] = header & 255;
  lldpFrame.set(bytes, lldpCursor);
  lldpCursor += bytes.length;
};
writeLldp(1, new Uint8Array([7, 100, 101, 118, 49, 0]));
writeLldp(5, new TextEncoder().encode('sw1'));
writeLldp(7, new Uint8Array([0, 4, 0, 4]));
writeLldp(8, new Uint8Array([5, 1, 192, 168, 3, 236]));
writeLldp(0, new Uint8Array());
const lldpResult = parseCdpLldpPacket(lldpFrame);
assert.equal(lldpResult.protocol, 'LLDP');
assert.equal(lldpResult.fields['System name'], 'sw1');
assert.equal(lldpResult.source, 'E0:63:DA:55:0A:6F');
assert.equal(lldpResult.fields.Capabilities, 'MAC Bridge');
assert.equal(lldpResult.fields['Management IPv4'], '192.168.3.236');

console.log('Pockethernet TDR protocol tests passed');
