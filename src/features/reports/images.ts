export function resizeReportImage(
  file: File,
  maxWidth = 1400,
  maxHeight = 1000,
  outputType = 'image/jpeg',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(image.src);
      resolve(canvas.toDataURL(outputType, 0.86));
    };
    image.onerror = () => reject(new Error('Could not read this image.'));
    image.src = URL.createObjectURL(file);
  });
}
