import type { jsPDF } from 'jspdf';
import type { FieldsResult } from '@/pockethernetProtocol';
import type { SavedReport } from '@/app/types';
import { drawTdrChart } from './reportPdfCharts';
import {
  BLUE,
  drawBrand,
  drawWiremap,
  field,
  formatDistance,
  line,
  pairColor,
  sectionTitle,
  textLine,
} from './reportPdfPrimitives';

function drawMetadata(doc: jsPDF, report: SavedReport): void {
  doc.setDrawColor(BLUE);
  doc.setLineWidth(0.4);
  doc.rect(10, 21, 190, 10.5);
  const date = new Date(report.createdAt);
  const pad = (value: number): string => value.toString().padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} - ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  textLine(doc, 'Date: ', stamp, 12, 24, 58);
  textLine(doc, 'User: ', report.details.user, 12, 27, 58);
  textLine(doc, 'Comment: ', report.details.comment, 12, 30, 58);
  textLine(doc, 'Address: ', report.details.address, 75, 24, 58);
  textLine(doc, 'Location: ', report.details.location, 75, 27, 58);
  textLine(doc, 'Port ID: ', report.details.portId, 75, 30, 58);
  textLine(doc, 'Tag: ', report.details.tag, 140, 24, 58);
}

function drawPoe(doc: jsPDF, report: SavedReport, x: number, y: number): void {
  const result = report.results.poe;
  let cursor = sectionTitle(doc, 'PoE', result?.summary ?? '', x, y, Boolean(result));
  if (!result) return;
  cursor = textLine(doc, 'Open voltage: ', `${result.openVoltage} V`, x, cursor);
  cursor = textLine(doc, 'Polarity: ', result.polarity, x, cursor);
  cursor = textLine(doc, 'Load voltage: ', `${result.loadVoltage} V`, x, cursor);
  cursor = textLine(doc, 'PSE type: ', result.poeType, x, cursor);
  textLine(doc, 'Max. class: ', result.maxClass ?? '', x, cursor);
}

function drawLink(doc: jsPDF, report: SavedReport, x: number, y: number): void {
  const result = report.results.link;
  let cursor = sectionTitle(doc, 'Link', result?.summary ?? '', x, y, Boolean(result));
  if (!result?.linkUp) return;
  const capabilities = [
    ['2.5/5/10G: ', result.partnerCapabilities.multig],
    ['1000 Mbit: ', result.partnerCapabilities['1000M']],
    ['100 Mbit: ', result.partnerCapabilities['100M']],
    ['10 Mbit: ', result.partnerCapabilities['10M']],
  ] as const;
  capabilities.forEach(([label, value]) => {
    cursor = textLine(doc, label, value, x, cursor);
  });
  result.polarity.forEach((value, index) => {
    cursor = textLine(
      doc,
      `P${[2, 3, 1, 4][index]}: `,
      value,
      x,
      cursor,
      57,
      pairColor(report.settings.tia, index),
    );
  });
}

function drawTdr(doc: jsPDF, report: SavedReport, x: number, y: number): void {
  const result = report.results.tdr;
  let cursor = sectionTitle(doc, 'TDR', result?.summary ?? '', x, y, Boolean(result));
  result?.pairs.forEach((pair, index) => {
    const value = pair.status
      ? `${pair.status} @ ${formatDistance(pair.distance, report.settings.units)}`
      : '-';
    cursor = textLine(
      doc,
      `P${[2, 3, 1, 4][index]}: `,
      value,
      x,
      cursor,
      57,
      pairColor(report.settings.tia, index),
    );
  });
}

function drawFields(
  doc: jsPDF,
  title: string,
  result: FieldsResult | null,
  x: number,
  y: number,
  keys?: string[],
): number {
  let cursor = sectionTitle(doc, title, result?.summary ?? '', x, y, Boolean(result));
  if (!result) return cursor;
  const entries = keys
    ? keys.map((key) => [key, result.fields[key]] as const)
    : Object.entries(result.fields);
  entries
    .filter(([, value]) => value)
    .forEach(([label, value]) => {
      cursor = textLine(doc, `${label}: `, value, x, cursor);
    });
  return cursor;
}

function drawIpv6(
  doc: jsPDF,
  report: SavedReport,
  protocol: 'SLAAC' | 'DHCPv6',
  title: string,
  x: number,
  y: number,
): number {
  const result = report.results.ipv6?.results.find((item) => item.protocol === protocol) ?? null;
  return drawFields(doc, title, result, x, y);
}

function drawPing(doc: jsPDF, report: SavedReport, x: number, y: number): void {
  const result = report.results.ping;
  let cursor = sectionTitle(doc, 'Ping', result?.summary ?? '', x, y, Boolean(result));
  result?.servers.forEach((server, index) => {
    cursor = textLine(doc, `${index}: `, `${server.ip} / ${server.time}`, x, cursor);
  });
}

function drawExternalIp(doc: jsPDF, report: SavedReport, x: number, y: number): void {
  const result = report.results.extip;
  let cursor = sectionTitle(doc, 'External IP', result?.summary ?? '', x, y, Boolean(result));
  if (!result) return;
  const rows = [
    ['IPv4: ', field(result.fields, 'IPv4', 'ipv4', 'IP')],
    ['AS: ', field(result.fields, 'AS', 'as')],
    ['ISP: ', field(result.fields, 'ISP', 'isp')],
    ['GeoIP: ', field(result.fields, 'GeoIP', 'geoip')],
  ] as const;
  rows.forEach(([label, value]) => {
    cursor = textLine(doc, label, value, x, cursor);
  });
}

function drawBer(doc: jsPDF, report: SavedReport, x: number, y: number): void {
  const result = report.results.ber;
  let cursor = sectionTitle(doc, 'Error rate', result?.summary ?? '', x, y, Boolean(result));
  if (!result) return;
  cursor = textLine(doc, 'Sent packets: ', result.sent.toString(), x, cursor);
  cursor = textLine(doc, 'Received: ', result.received.toString(), x, cursor);
  cursor = textLine(doc, 'Packets with error: ', result.errors.toString(), x, cursor);
  textLine(doc, 'Error ratio: ', result.errorRate, x, cursor);
}

function drawDiscovery(
  doc: jsPDF,
  report: SavedReport,
  protocol: 'LLDP' | 'CDP',
  x: number,
  y: number,
): number {
  const result = report.results.cdplldp;
  if (!result || result.status !== 'OK' || result.protocol !== protocol)
    return sectionTitle(doc, protocol, '', x, y, false, 84);
  let cursor = sectionTitle(doc, protocol, '', x, y, true, 84);
  cursor = textLine(doc, 'Eth Src Addr: ', result.source, x, cursor, 84);
  Object.entries(result.fields)
    .filter(([key, value]) => value && key !== 'Eth Dst Addr' && key !== 'Protocol')
    .slice(0, 12)
    .forEach(([label, value]) => {
      cursor = textLine(doc, `${label}: `, value, x, cursor, 84);
    });
  return cursor;
}

function drawPhoto(doc: jsPDF, report: SavedReport, y: number): void {
  if (!report.photoDataUrl || y >= 278) return;
  try {
    const image = doc.getImageProperties(report.photoDataUrl);
    const ratio = image.width / image.height;
    const width = Math.min(190, (280 - y) * ratio);
    const height = width / ratio;
    doc.addImage(report.photoDataUrl, image.fileType, 10 + (190 - width) / 2, y, width, height);
  } catch {
    // Reports remain exportable if a stored attachment is no longer readable.
  }
}

export function drawReportPage(doc: jsPDF, report: SavedReport, logoDataUrl: string): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('Measurement report', 12, 15);
  drawBrand(doc, logoDataUrl);
  line(doc, 292);
  doc.setFillColor(255, 255, 255);
  doc.rect(85, 287, 40, 9, 'F');
  drawBrand(doc, '', true);
  drawMetadata(doc, report);
  drawWiremap(doc, report, 12, 36);
  drawPoe(doc, report, 75, 36);
  drawLink(doc, report, 140, 36);
  line(doc, 63);
  drawTdr(doc, report, 12, 67);
  drawTdrChart(
    doc,
    report.results.tdrGraph,
    'impedance',
    75,
    65,
    58,
    28,
    report.settings.units,
    report.settings.tia,
  );
  drawTdrChart(
    doc,
    report.results.tdrGraph,
    'crosstalk',
    140,
    65,
    58,
    28,
    report.settings.units,
    report.settings.tia,
  );
  line(doc, 95);
  drawFields(doc, 'DHCPv4', report.results.ipv4, 12, 100, [
    'Your IP',
    'Source IP',
    'Eth Src Addr',
    'Server ID',
    'Relay IP',
    'Subnet Mask',
    'Gateway',
    'DNS Servers',
  ]);
  drawIpv6(doc, report, 'SLAAC', 'IPv6 ND', 75, 100);
  drawIpv6(doc, report, 'DHCPv6', 'DHCPv6', 140, 100);
  line(doc, 126);
  drawPing(doc, report, 12, 131);
  drawExternalIp(doc, report, 75, 131);
  drawBer(doc, report, 140, 131);
  line(doc, 151);
  const lldpEnd = drawDiscovery(doc, report, 'LLDP', 12, 156);
  const cdpEnd = drawDiscovery(doc, report, 'CDP', 105, 156);
  const discoveryEnd = Math.max(181, lldpEnd, cdpEnd);
  line(doc, discoveryEnd);
  drawPhoto(doc, report, discoveryEnd + 4);
}
