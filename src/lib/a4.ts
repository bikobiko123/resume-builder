/**
 * A4 geometry, shared by the on-screen preview and the headless measurement so
 * the two cannot disagree about how wide a page is.
 *
 * CSS defines 1in as exactly 96px, so a millimetre is exactly 96/25.4px and a
 * sheet of A4 is 793.7 x 1122.5 CSS px. The browser lays `.a4-page` out at that
 * size; the preview *zoom* only scales what you look at, never the layout.
 */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PX_PER_MM = 96 / 25.4;

export const A4_WIDTH_PX = A4_WIDTH_MM * PX_PER_MM;
export const A4_HEIGHT_PX = A4_HEIGHT_MM * PX_PER_MM;

/** Zoom bounds for the preview viewport (a viewing convenience, not part of the document). */
export const MIN_PREVIEW_ZOOM = 0.45;
export const MAX_PREVIEW_ZOOM = 1.4;
export const PREVIEW_ZOOM_STEP = 0.1;

export const clampPreviewZoom = (value: number): number => {
  if (!Number.isFinite(value)) return 1;
  const clamped = Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, value));
  return Number(clamped.toFixed(2));
};

/**
 * The zoom at which a full-width A4 page exactly fits `availableWidth`.
 *
 * Rounded *down*: rounding up by half a percent would leave the sheet a couple
 * of pixels wider than the panel and put a scrollbar under every document.
 *
 * Never exceeds 1: at 100% the page is its true physical size, and blowing it up
 * to fill a wide panel would make the on-screen size meaningless. The user can
 * still zoom past it by hand.
 */
export const fitPreviewZoom = (availableWidth: number): number => {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1;
  const exact = Math.min(1, availableWidth / A4_WIDTH_PX);
  return clampPreviewZoom(Math.floor(exact * 100) / 100);
};
