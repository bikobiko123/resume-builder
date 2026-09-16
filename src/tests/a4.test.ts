import { describe, expect, it } from 'vitest';
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  MAX_PREVIEW_ZOOM,
  MIN_PREVIEW_ZOOM,
  clampPreviewZoom,
  fitPreviewZoom,
} from '../lib/a4';

describe('A4 geometry', () => {
  it('is 210 x 297mm at the CSS 96dpi definition', () => {
    expect(A4_WIDTH_PX).toBeCloseTo(793.7, 1);
    expect(A4_HEIGHT_PX).toBeCloseTo(1122.5, 1);
  });
});

describe('fitPreviewZoom', () => {
  it('shrinks to fit a narrow panel', () => {
    // The real preview column: 440px panel less the stage's 18px side padding.
    expect(fitPreviewZoom(404)).toBe(0.5);
  });

  it('rounds down, so the sheet never overflows the panel', () => {
    const available = 404;
    const zoom = fitPreviewZoom(available);
    // Rounding up would give 0.51 and a 2px horizontal scrollbar.
    expect(zoom * A4_WIDTH_PX).toBeLessThanOrEqual(available);
    expect(fitPreviewZoom(405.5) * A4_WIDTH_PX).toBeLessThanOrEqual(405.5);
  });

  it('never exceeds 100%, however wide the panel', () => {
    expect(fitPreviewZoom(2000)).toBe(1);
    expect(fitPreviewZoom(A4_WIDTH_PX)).toBe(1);
  });

  it('respects the lower bound on an absurdly narrow panel', () => {
    expect(fitPreviewZoom(10)).toBe(MIN_PREVIEW_ZOOM);
  });

  it('falls back to 100% for a width that has not been measured yet', () => {
    expect(fitPreviewZoom(0)).toBe(1);
    expect(fitPreviewZoom(-5)).toBe(1);
    expect(fitPreviewZoom(Number.NaN)).toBe(1);
  });
});

describe('clampPreviewZoom', () => {
  it('keeps a manual zoom inside the bounds and at two decimals', () => {
    expect(clampPreviewZoom(0.6000000000000001)).toBe(0.6);
    expect(clampPreviewZoom(0.1)).toBe(MIN_PREVIEW_ZOOM);
    expect(clampPreviewZoom(99)).toBe(MAX_PREVIEW_ZOOM);
  });
});
