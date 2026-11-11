import type { jsPDF } from 'jspdf';
import type { ReportPhoto } from '@/app/types';
import { BLUE, wrap } from './reportPdfPrimitives';

const BOTTOM = 280;
const DESCRIPTION_LINE_HEIGHT = 4;

export function drawReportPhotos(
  doc: jsPDF,
  photos: ReportPhoto[],
  y: number,
  newPage: () => void,
): void {
  let cursor = y;
  photos.forEach((photo, index) => {
    try {
      const image = doc.getImageProperties(photo.dataUrl);
      const ratio = image.width / image.height;
      const preferredHeight = Math.min(160, 190 / ratio);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const description = photo.description.trim() ? wrap(doc, photo.description, 186) : [];
      // Keep the start of a description with its image, then flow longer text across pages.
      const descriptionSpace = description.length
        ? 4 + Math.min(2, description.length) * DESCRIPTION_LINE_HEIGHT
        : 0;
      // Use the remaining space unless it would make the image too small to read.
      if (cursor + 4 + Math.min(60, preferredHeight) + descriptionSpace > BOTTOM) {
        newPage();
        cursor = 24;
      }
      const height = Math.min(preferredHeight, BOTTOM - cursor - 4 - descriptionSpace);
      const width = height * ratio;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(BLUE);
      const title = `Image ${index + 1} of ${photos.length}`;
      doc.text(title, 10, cursor);
      doc.addImage(
        photo.dataUrl,
        image.fileType,
        10 + (190 - width) / 2,
        cursor + 4,
        width,
        height,
      );
      cursor += 4 + height;
      if (description.length) cursor += 4;
      for (const value of description) {
        if (cursor + DESCRIPTION_LINE_HEIGHT > BOTTOM) {
          newPage();
          cursor = 24;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.2);
          doc.setTextColor(BLUE);
          doc.text(`${title} description (continued)`, 10, cursor);
          cursor += 5;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(value, 12, cursor);
        cursor += DESCRIPTION_LINE_HEIGHT;
      }
      cursor += 8;
    } catch {
      // One unreadable attachment must not prevent the other photos from exporting.
    }
  });
}
