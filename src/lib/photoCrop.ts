export interface CropSettings {
  zoom: number;
  offsetX: number;
  offsetY: number;
  outputSize?: number;
}

interface CropRect {
  sx: number;
  sy: number;
  sSize: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const computeCropRect = (
  imageWidth: number,
  imageHeight: number,
  settings: CropSettings,
): CropRect => {
  const safeZoom = clamp(settings.zoom || 1, 1, 3);
  const baseSize = Math.min(imageWidth, imageHeight) / safeZoom;
  const maxShiftX = Math.max(0, (imageWidth - baseSize) / 2);
  const maxShiftY = Math.max(0, (imageHeight - baseSize) / 2);

  const centeredX = imageWidth / 2 - baseSize / 2;
  const centeredY = imageHeight / 2 - baseSize / 2;

  const sx = clamp(centeredX + (settings.offsetX / 100) * maxShiftX, 0, imageWidth - baseSize);
  const sy = clamp(centeredY + (settings.offsetY / 100) * maxShiftY, 0, imageHeight - baseSize);

  return { sx, sy, sSize: baseSize };
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });

export const renderCroppedDataUrl = async (src: string, settings: CropSettings): Promise<string> => {
  const image = await loadImage(src);
  const outputSize = settings.outputSize ?? 360;
  const { sx, sy, sSize } = computeCropRect(image.width, image.height, settings);

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建裁剪画布');
  }

  ctx.drawImage(image, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize);
  return canvas.toDataURL('image/jpeg', 0.92);
};
