import { zipSync } from 'fflate';

export interface ReportFile {
  name: string;
  blob: () => Blob;
}

export interface ReportDirectory {
  getFileHandle(
    name: string,
    options?: { create: boolean },
  ): Promise<{
    createWritable(): Promise<{
      write(blob: Blob): Promise<void>;
      close(): Promise<void>;
      abort(): Promise<void>;
    }>;
  }>;
}

type FolderWindow = Window & {
  showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<ReportDirectory>;
};

export function supportsReportFolder(): boolean {
  return typeof (window as FolderWindow).showDirectoryPicker === 'function';
}

export function pickReportFolder(): Promise<ReportDirectory> {
  const picker = (window as FolderWindow).showDirectoryPicker;
  if (!picker) throw new Error('Folder export requires desktop Chrome or Edge.');
  return picker.call(window, { mode: 'readwrite' });
}

export function uniqueReportFilename(name: string, used: Set<string>): string {
  let stem = name
    // eslint-disable-next-line no-control-regex -- Control characters are invalid in filesystem names.
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .slice(0, 160)
    .replace(/[. ]+$/g, '');
  if (!stem) stem = 'measurement';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(stem)) stem = `_${stem}`;
  let filename = `${stem}.pdf`;
  for (let suffix = 2; used.has(filename.toLowerCase()); suffix++) {
    filename = `${stem} (${suffix}).pdf`;
  }
  used.add(filename.toLowerCase());
  return filename;
}

export function downloadReportBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function createReportsZip(
  files: ReportFile[],
  onProgress: (completed: number) => void = () => undefined,
): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  for (const [index, file] of files.entries()) {
    entries[file.name] = new Uint8Array(await file.blob().arrayBuffer());
    onProgress(index + 1);
  }
  // PDFs are already compressed; storing them avoids redundant compression work.
  const zipped = zipSync(entries, { level: 0 });
  return new Blob([new Uint8Array(zipped)], { type: 'application/zip' });
}

export async function saveReportFilesToFolder(
  files: ReportFile[],
  directory: ReportDirectory,
  onProgress: (completed: number) => void = () => undefined,
): Promise<void> {
  for (const [index, file] of files.entries()) {
    const stem = file.name.slice(0, -4);
    let name = file.name;
    // Preserve existing exports, including earlier retests of the same cable.
    for (let suffix = 2; ; suffix++) {
      try {
        await directory.getFileHandle(name);
        name = `${stem} (${suffix}).pdf`;
      } catch (reason) {
        if (!(reason instanceof Error) || reason.name !== 'NotFoundError') throw reason;
        break;
      }
    }
    const blob = file.blob();
    const handle = await directory.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(blob);
      await writable.close();
    } catch (reason) {
      await writable.abort().catch(() => undefined);
      throw reason;
    }
    onProgress(index + 1);
  }
}
