import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync } from 'fflate';
import {
  createReportsZip,
  saveReportFilesToFolder,
  uniqueReportFilename,
  type ReportDirectory,
  type ReportFile,
} from './reportFiles';

const files: ReportFile[] = [
  { name: 'Cable 001.pdf', blob: () => new Blob(['%PDF-first']) },
  { name: 'Cable 002.pdf', blob: () => new Blob(['%PDF-second']) },
];

await test('filenames are safe and distinguish repeated or case-insensitive cable names', () => {
  const used = new Set<string>();
  assert.equal(uniqueReportFilename('Cable:001', used), 'Cable-001.pdf');
  assert.equal(uniqueReportFilename('cable:001', used), 'cable-001 (2).pdf');
  assert.equal(uniqueReportFilename('Cable:001', used), 'Cable-001 (3).pdf');
  assert.equal(uniqueReportFilename('NUL', used), '_NUL.pdf');
  assert.equal(uniqueReportFilename('trailing. ', used), 'trailing.pdf');
  assert.equal(uniqueReportFilename('', used), 'measurement.pdf');
});

await test('ZIP contains separate files with intact contents and reports progress', async () => {
  const progress: number[] = [];
  const zip = await createReportsZip(files, (count) => progress.push(count));
  assert.equal(zip.type, 'application/zip');
  const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  assert.deepEqual(
    Object.keys(entries),
    files.map((file) => file.name),
  );
  assert.equal(new TextDecoder().decode(entries['Cable 001.pdf']), '%PDF-first');
  assert.equal(new TextDecoder().decode(entries['Cable 002.pdf']), '%PDF-second');
  assert.deepEqual(progress, [1, 2]);
});

function directory(existing: string[], failOn?: string) {
  const contents = new Map(existing.map((name) => [name, 'existing']));
  const aborted: string[] = [];
  const closed: string[] = [];
  const handle: ReportDirectory = {
    getFileHandle(name, options) {
      if (!options?.create && !contents.has(name)) {
        return Promise.reject(Object.assign(new Error('Missing file'), { name: 'NotFoundError' }));
      }
      return Promise.resolve({
        createWritable() {
          let content = '';
          return Promise.resolve({
            async write(blob) {
              if (name === failOn) throw new Error('Disk full');
              content = await blob.text();
            },
            close() {
              contents.set(name, content);
              closed.push(name);
              return Promise.resolve();
            },
            abort() {
              aborted.push(name);
              return Promise.resolve();
            },
          });
        },
      });
    },
  };
  return { handle, contents, aborted, closed };
}

await test('folder export preserves existing PDFs and writes each report separately', async () => {
  const folder = directory(['Cable 001.pdf', 'Cable 001 (2).pdf']);
  const progress: number[] = [];
  await saveReportFilesToFolder(files, folder.handle, (count) => progress.push(count));
  assert.equal(folder.contents.get('Cable 001.pdf'), 'existing');
  assert.equal(folder.contents.get('Cable 001 (2).pdf'), 'existing');
  assert.equal(folder.contents.get('Cable 001 (3).pdf'), '%PDF-first');
  assert.equal(folder.contents.get('Cable 002.pdf'), '%PDF-second');
  assert.deepEqual(progress, [1, 2]);
  assert.deepEqual(folder.closed, ['Cable 001 (3).pdf', 'Cable 002.pdf']);
});

await test('failed folder writes abort and only count completed files', async () => {
  const folder = directory([], 'Cable 002.pdf');
  const progress: number[] = [];
  await assert.rejects(
    saveReportFilesToFolder(files, folder.handle, (count) => progress.push(count)),
    /Disk full/,
  );
  assert.deepEqual(progress, [1]);
  assert.deepEqual(folder.aborted, ['Cable 002.pdf']);
  assert.equal(folder.contents.get('Cable 001.pdf'), '%PDF-first');
  assert.equal(folder.contents.has('Cable 002.pdf'), false);
});

await test('folder access errors propagate without creating a file', async () => {
  let created = false;
  const denied: ReportDirectory = {
    getFileHandle(_name, options) {
      created ||= !!options?.create;
      return Promise.reject(
        Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }),
      );
    },
  };
  await assert.rejects(saveReportFilesToFolder(files, denied), /Permission denied/);
  assert.equal(created, false);
});
