import { useRef, type ChangeEvent, type ReactElement } from 'react';
import { FiCamera, FiImage } from 'react-icons/fi';
import type { StateSetter } from '@/app/types';
import { Button } from '@/shared/ui/UiPrimitives';
import { resizeReportImage } from './images';

export function ReportPhotos({
  photos,
  onPhotosChange,
  busy,
  onBusyChange,
  onNotice,
}: {
  photos: string[];
  onPhotosChange: StateSetter<string[]>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onNotice: (message: string) => void;
}): ReactElement {
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const addPhotos = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length === 0 || pending.current) return;
    pending.current = true;
    onBusyChange(true);
    const added: string[] = [];
    let failed = 0;
    try {
      // Resize sequentially to keep large camera originals out of memory together.
      for (const file of files) {
        try {
          added.push(await resizeReportImage(file));
        } catch {
          failed++;
        }
      }
      onPhotosChange((current) => [...current, ...added]);
      if (failed)
        onNotice(`Could not read ${failed} image${failed === 1 ? '' : 's'}. Try another image.`);
    } finally {
      pending.current = false;
      onBusyChange(false);
    }
  };

  return (
    <div className="report-photos" aria-busy={busy}>
      <div className="report-photo-row">
        <span>Report images{photos.length > 0 && ` (${photos.length})`}</span>
        <div className="report-photo-actions">
          <Button disabled={busy} onClick={() => galleryInput.current?.click()}>
            <FiImage aria-hidden="true" /> Add image
          </Button>
          <Button disabled={busy} onClick={() => cameraInput.current?.click()}>
            <FiCamera aria-hidden="true" /> Camera
          </Button>
        </div>
        <input
          ref={galleryInput}
          hidden
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => void addPhotos(event)}
        />
        <input
          ref={cameraInput}
          hidden
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => void addPhotos(event)}
        />
      </div>
      {busy && (
        <p className="report-photo-status" role="status">
          Adding images…
        </p>
      )}
      {photos.length > 0 && (
        <div className="report-photo-gallery">
          {photos.map((photo, index) => (
            <figure key={index}>
              <img src={photo} alt={`Report image ${index + 1}`} />
              <figcaption>
                <span>Image {index + 1}</span>
                <Button
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Remove image ${index + 1}`}
                  onClick={() =>
                    onPhotosChange((current) => current.filter((_, item) => item !== index))
                  }
                >
                  Remove
                </Button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
