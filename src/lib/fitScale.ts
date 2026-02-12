const MIN_SCALE = 0.5;
const MAX_SCALE = 1;

export const computeFitScale = (naturalHeightPx: number, pageHeightPx: number): number => {
  if (!Number.isFinite(naturalHeightPx) || !Number.isFinite(pageHeightPx)) {
    return MAX_SCALE;
  }
  if (naturalHeightPx <= 0 || pageHeightPx <= 0) {
    return MAX_SCALE;
  }

  const ratio = pageHeightPx / naturalHeightPx;
  if (ratio >= MAX_SCALE) {
    return MAX_SCALE;
  }
  if (ratio <= MIN_SCALE) {
    return MIN_SCALE;
  }
  return Number(ratio.toFixed(3));
};
