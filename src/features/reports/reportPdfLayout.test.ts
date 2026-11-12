import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { inflateSync } from 'node:zlib';
import { build } from 'esbuild';
import type { jsPDF } from 'jspdf';
import type { SavedReport } from '@/app/types';
import type * as Pdf from './pdf';

const bundled = await build({
  entryPoints: ['src/features/reports/pdf.ts'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  external: ['jspdf'],
  loader: { '.png': 'dataurl' },
});
const bundledModule: { exports: Partial<typeof Pdf> } = { exports: {} };
runInNewContext(bundled.outputFiles[0].text, {
  module: bundledModule,
  require: createRequire(import.meta.url),
});
const { createReportsPdf } = bundledModule.exports;
assert.ok(createReportsPdf);

function report(comment: string): SavedReport {
  return {
    id: 'report-layout-test',
    createdAt: '2026-11-11T03:02:58.000Z',
    details: {
      user: 'ABC Technologies',
      address: '123 Service Road',
      location: 'San Juan',
      portId: 'Patch Panel 1',
      tag: 'Layout test',
      comment,
    },
    settings: { tia: '568B', units: 'meters', nvp: '68' },
    photos: [],
    results: {
      wiremap: {
        status: 'OK',
        summary: '4 pairs straight (S)',
        id: 1,
        adapterType: 1,
        connections: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        shorts: Array<number>(10).fill(0),
      },
      tdr: null,
      tdrGraph: null,
      poe: null,
      link: null,
      ber: null,
      cdplldp: null,
      vlan: null,
      traffic: null,
      ipv4: null,
      ipv6: null,
      ping: null,
      extip: null,
    },
  };
}

function pageStreams(doc: jsPDF): string[] {
  const output = doc.output();
  const streams: string[] = [];
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    const objectId = doc.getPageInfo(page).objId;
    const object = output.match(new RegExp(`(?:^|\\n)${objectId} 0 obj\\n([\\s\\S]*?)endobj`));
    assert.ok(object);
    const contents = object[1].match(/\/Contents (\d+) 0 R/);
    assert.ok(contents);
    const streamObject = output.match(
      new RegExp(`(?:^|\\n)${contents[1]} 0 obj\\n([\\s\\S]*?)endobj`),
    );
    assert.ok(streamObject);
    const stream = streamObject[1].match(/stream\n([\s\S]*?)\nendstream/);
    assert.ok(stream);
    streams.push(
      streamObject[1].includes('/FlateDecode')
        ? inflateSync(Buffer.from(stream[1], 'latin1')).toString('latin1')
        : stream[1],
    );
  }
  return streams;
}

function textPages(doc: jsPDF): { text: string; x: number; y: number }[][] {
  return pageStreams(doc).map((data) => {
    const text: { text: string; x: number; y: number }[] = [];
    for (const block of data.matchAll(/BT\n([\s\S]*?)\nET/g)) {
      const position = block[1].match(/([\d.-]+) ([\d.-]+) Td/);
      const spacing = block[1].match(/([\d.-]+) TL/);
      if (!position) continue; // Rotated chart axis titles use a text matrix.
      assert.ok(spacing);
      let y = doc.internal.pageSize.getHeight() - Number(position[2]) / doc.internal.scaleFactor;
      for (const line of block[1].matchAll(/(?:T\* )?\(((?:\\.|[^\\)])*)\) Tj/g)) {
        text.push({
          text: line[1].replace(/\\([\\()])/g, '$1'),
          x: Number(position[1]) / doc.internal.scaleFactor,
          y,
        });
        y += Number(spacing[1]) / doc.internal.scaleFactor;
      }
    }
    return text;
  });
}

for (const comment of [
  '',
  'This is an explanation of the test and the reason for it. It could be somewhat long depending on what needs to be checked. '.repeat(
    12,
  ) + 'FINAL_COMMENT_MARKER',
  Array.from({ length: 200 }, (_, index) => `Comment line ${index + 1}`).join('\n'),
]) {
  const doc = createReportsPdf([report(comment)], '', false);
  const pages = textPages(doc);
  const commentText: string[] = [];
  for (const page of pages) {
    const label = page.findIndex((item) => item.text === 'Comment: ');
    if (label < 0) continue;
    const wiremap = page.find((item) => item.text === 'Wiremap');
    const notes = page.slice(label + 1).filter((item) => !wiremap || item.y < wiremap.y);
    for (const item of notes) {
      assert.ok(item.y < 280, 'Comments must remain above the footer');
      assert.ok(item.x >= 12 && item.x < 198, 'Comments must stay inside the metadata box');
      if (wiremap)
        assert.ok(item.y + 3.1 < wiremap.y, 'Measurements must clear every comment line');
      commentText.push(item.text);
    }
  }
  assert.equal(
    commentText.join(' ').replace(/\s+/g, ' ').trim(),
    comment.replace(/\s+/g, ' ').trim(),
  );
  assert.equal(pages.flat().filter((item) => item.text === 'Wiremap').length, 1);
  if (comment.startsWith('Comment line')) assert.ok(pages.length >= 3);
}

const batch = createReportsPdf(
  [report('First report'), report('Comment line\n'.repeat(200)), report('Last report')],
  '',
  false,
);
const batchPages = textPages(batch);
assert.equal(batchPages.flat().filter((item) => item.text === 'Wiremap').length, 3);
assert.ok(batchPages[batchPages.length - 1]?.some((item) => item.text === 'Last report'));

const photo = `data:image/png;base64,${readFileSync('src/assets/logo.png').toString('base64')}`;
const illustrated = {
  ...report('Photos must follow these test results.'),
  photos: Array.from({ length: 7 }, () => ({ dataUrl: photo, description: '' })),
};
const illustratedPdf = createReportsPdf([illustrated, report('Next report')], '', true);
const illustratedPages = textPages(illustratedPdf);
const captions = illustratedPages.flat().filter((item) => /^Image \d+ of 7$/.test(item.text));
assert.deepEqual(
  captions.map((item) => item.text),
  Array.from({ length: 7 }, (_, index) => `Image ${index + 1} of 7`),
);
assert.ok(illustratedPages.length > 2, 'Extra photos must flow onto additional pages');
assert.ok(
  illustratedPages[0].some((item) => item.text === 'Image 1 of 7'),
  'Use space on the measurement page',
);
assert.ok(
  illustratedPages[illustratedPages.length - 1].some((item) => item.text === 'Next report'),
);
let photoCount = 0;
for (const data of pageStreams(illustratedPdf)) {
  const images: { top: number; bottom: number }[] = [];
  for (const image of data.matchAll(/([\d.-]+) 0 0 ([\d.-]+) ([\d.-]+) ([\d.-]+) cm\n\/I\d+ Do/g)) {
    const width = Number(image[1]) / illustratedPdf.internal.scaleFactor;
    const height = Number(image[2]) / illustratedPdf.internal.scaleFactor;
    const x = Number(image[3]) / illustratedPdf.internal.scaleFactor;
    const top =
      illustratedPdf.internal.pageSize.getHeight() -
      Number(image[4]) / illustratedPdf.internal.scaleFactor -
      height;
    if (top < 24 || top > 280) continue; // Header and footer logos.
    assert.ok(x >= 10 - 0.001 && x + width <= 200 + 0.001);
    assert.ok(top + height <= 280 + 0.001, 'Photos must remain above the footer');
    images.push({ top, bottom: top + height });
    photoCount++;
  }
  for (let index = 1; index < images.length; index++) {
    assert.ok(images[index].top >= images[index - 1].bottom + 8, 'Stack photos without overlap');
  }
}
assert.equal(photoCount, 7, 'Every photo must be drawn, including repeated images');
const unreadable = createReportsPdf(
  [
    {
      ...illustrated,
      photos: [
        { dataUrl: 'broken-image', description: '' },
        { dataUrl: photo, description: '' },
      ],
    },
  ],
  '',
  false,
);
assert.ok(
  textPages(unreadable)
    .flat()
    .some((item) => item.text === 'Image 2 of 2'),
  'A bad image must not prevent the next one exporting',
);
const sparse: SavedReport = {
  ...report('Only recorded results should appear.'),
  results: {
    ...report('').results,
    wiremap: null,
    poe: {
      status: 'not_OK',
      summary: 'No PoE',
      poeType: '',
      openVoltage: 0,
      loadVoltage: 0,
      polarity: '',
      adc: [],
      pairVoltages: [],
    },
    extip: {
      status: 'OK',
      summary: 'External IP obtained',
      fields: {
        IPv4: '203.0.113.7',
        AS: 'Client network operator '.repeat(15) + 'AS_END',
        ISP: 'A detailed explanation of the service provider and route '.repeat(30) + 'ISP_END',
        GeoIP: 'An extensive location description '.repeat(25) + 'GEO_END',
      },
    },
    ber: {
      summary: 'No errors',
      sent: 100,
      received: 100,
      errors: 0,
      ratio: 0,
      errorRate: '0%',
      completedBatches: 1,
      batchCount: 1,
    },
  },
  photos: [{ dataUrl: photo, description: '' }],
};
const sparsePdf = createReportsPdf([sparse], '', false);
const sparsePages = textPages(sparsePdf);
const sparseText = sparsePages
  .flat()
  .map((item) => item.text)
  .join(' ');
for (const absent of ['DHCPv4', 'IPv6 ND', 'DHCPv6', 'Ping', 'LLDP', 'CDP', 'TDR', 'Wiremap']) {
  assert.ok(
    !sparsePages.flat().some((item) => item.text === absent),
    `${absent} must be omitted when not measured`,
  );
}
for (const marker of ['AS_END', 'ISP_END', 'GEO_END', 'No PoE', 'Image 1 of 1'])
  assert.ok(sparseText.includes(marker));
for (const page of sparsePages) {
  for (const item of page)
    assert.ok(item.y <= 280 + 0.001, 'Result text must remain inside the page');
  const external = page.find((item) => item.text === 'External IP');
  const ber = page.find((item) => item.text === 'Error rate');
  if (external && ber) {
    const lastGeo = page.find((item) => item.text.includes('GEO_END'));
    assert.ok(
      lastGeo && ber.y > lastGeo.y + 3.1,
      'The next section must follow all External IP content',
    );
  }
}
assert.ok((sparsePages[0].find((item) => item.text === 'External IP')?.y ?? 280) < 100);

const veryLong = createReportsPdf(
  [
    {
      ...sparse,
      results: {
        ...sparse.results,
        extip: {
          status: 'OK',
          summary: 'Long External IP information',
          fields: {
            ISP: Array.from({ length: 200 }, (_, index) => `ISP line ${index + 1}`).join('\n'),
          },
        },
      },
    },
  ],
  '',
  false,
);
const longPages = textPages(veryLong);
assert.ok(longPages.length >= 3);
const ispLines = longPages.flat().filter((item) => /^ISP line \d+$/.test(item.text));
assert.equal(ispLines.length, 200, 'Fields longer than one page must keep every line');
assert.ok(longPages.flat().some((item) => item.text === 'External IP (continued)'));
assert.ok(ispLines.every((item) => item.y <= 280));

const descriptionLines = Array.from(
  { length: 180 },
  (_, index) => `Photo description line ${index + 1}`,
);
const described = createReportsPdf(
  [
    {
      ...report('Descriptions should flow beneath each photo.'),
      photos: [
        { dataUrl: photo, description: 'Switch port 24\nPatch panel A, outlet 12.' },
        { dataUrl: photo, description: descriptionLines.join('\n') },
        {
          dataUrl: photo,
          description: 'Access point installed above the ceiling. '.repeat(45) + 'DESCRIPTION_END',
        },
        { dataUrl: photo, description: ' \n  ' },
      ],
    },
    report('Report after described images'),
  ],
  '',
  true,
);
const describedPages = textPages(described);
const describedText = describedPages.flat();
assert.ok(describedPages.length >= 5, 'Long descriptions must continue onto extra pages');
assert.deepEqual(
  describedText
    .filter((item) => /^Photo description line \d+$/.test(item.text))
    .map((item) => item.text),
  descriptionLines,
  'Every explicit description line must be preserved in order',
);
assert.ok(
  describedText.some((item) => item.text.includes('DESCRIPTION_END')),
  'Wrapped descriptions must not be truncated',
);
assert.ok(describedText.some((item) => item.text === 'Image 2 of 4 description (continued)'));
assert.ok(
  describedPages[describedPages.length - 1]?.some(
    (item) => item.text === 'Report after described images',
  ),
);
const firstPhotoPage = describedPages.find((page) =>
  page.some((item) => item.text === 'Image 1 of 4'),
);
assert.ok(firstPhotoPage);
const firstLine = firstPhotoPage.find((item) => item.text === 'Switch port 24');
const secondLine = firstPhotoPage.find((item) => item.text === 'Patch panel A, outlet 12.');
assert.ok(firstLine && secondLine, 'Keep short multiline descriptions with their image');
assert.ok(secondLine.y > firstLine.y + 3.9, 'Explicit line breaks must use separate lines');
described.setFont('helvetica', 'normal');
described.setFontSize(8.5);
for (const page of describedPages) {
  for (const item of page) {
    assert.ok(item.y <= 280 + 0.001, 'Photo description text must remain above the footer');
    if (/^(?:Photo description line|Switch port|Patch panel A|Access point)/.test(item.text))
      assert.ok(item.x >= 12 && item.x + described.getTextWidth(item.text) <= 198 + 0.1);
  }
}
pageStreams(described).forEach((data, pageIndex) => {
  const descriptions = describedPages[pageIndex].filter((item) =>
    /^(?:Photo description line|Switch port|Patch panel A|Access point)/.test(item.text),
  );
  for (const image of data.matchAll(/([\d.-]+) 0 0 ([\d.-]+) ([\d.-]+) ([\d.-]+) cm\n\/I\d+ Do/g)) {
    const height = Number(image[2]) / described.internal.scaleFactor;
    const top =
      described.internal.pageSize.getHeight() -
      Number(image[4]) / described.internal.scaleFactor -
      height;
    if (top < 24 || top > 280) continue;
    assert.ok(top + height <= 280 + 0.001);
    assert.ok(
      descriptions.every((item) => item.y < top || item.y >= top + height + 3.9),
      'Descriptions must clear the image above them and the next image below them',
    );
  }
});
console.log(
  'Compact report sections, long fields, multiline photo descriptions and page continuation passed.',
);

const partialRun = createReportsPdf(
  [
    {
      ...report('Partial run'),
      selectedTests: ['wiremap', 'poe', 'traffic'],
      failures: { poe: 'The device did not respond in time' },
      runError: 'Bluetooth connection lost',
    },
  ],
  '',
  false,
);
const partialText = textPages(partialRun)
  .flat()
  .map((item) => item.text)
  .join('\n');
assert.match(partialText, /Wiremap, PoE, Traffic/);
assert.match(partialText, /The device did not respond in time/);
assert.match(partialText, /No result recorded/);
assert.match(partialText, /Bluetooth connection lost/);
