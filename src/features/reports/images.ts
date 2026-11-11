export function resizeReportImage(
  file: File,
  maxWidth = 1400,
  maxHeight = 1000,
  outputType = 'image/jpeg',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const source = URL.createObjectURL(file);
    image.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not resize this image.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(outputType, 0.86));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Could not resize this image.'));
      } finally {
        URL.revokeObjectURL(source);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error('Could not read this image.'));
    };
    image.src = source;
  });
}
