import type { jsPDF } from 'jspdf';
import { BLUE } from './reportPdfPrimitives';

export function drawReportPhotos(
  doc: jsPDF,
  photos: string[],
  y: number,
  newPage: () => void,
): void {
  let cursor = y;
  photos.forEach((photo, index) => {
    try {
      const image = doc.getImageProperties(photo);
      const ratio = image.width / image.height;
      const preferredHeight = Math.min(160, 190 / ratio);
      // Use the remaining space unless it would make the image too small to read.
      if (cursor + 4 + Math.min(60, preferredHeight) > 280) {
        newPage();
        cursor = 24;
      }
      const height = Math.min(preferredHeight, 280 - cursor - 4);
      const width = height * ratio;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(BLUE);
      doc.text(`Image ${index + 1} of ${photos.length}`, 10, cursor);
      doc.addImage(photo, image.fileType, 10 + (190 - width) / 2, cursor + 4, width, height);
      cursor += 4 + height + 8;
    } catch {
      // One unreadable attachment must not prevent the other photos from exporting.
    }
  });
}
