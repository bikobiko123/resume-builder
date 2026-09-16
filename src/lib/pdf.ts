const settleImages = async (): Promise<void> => {
  const images = Array.from(document.images);
  await Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      });
    }
    try {
      await image.decode();
    } catch {
      // A broken optional image must not leave the print action hanging.
    }
  }));
};

export const preparePrint = async (): Promise<void> => {
  if (typeof document === 'undefined') {
    return;
  }
  try {
    await document.fonts.ready;
  } catch {
    // Older browsers may not expose the FontFaceSet promise.
  }
  await settleImages();
  document.body.classList.add('print-mode');
};

export const exportPdf = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.print();
};
