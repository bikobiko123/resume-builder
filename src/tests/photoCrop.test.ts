import { describe, expect, it } from 'vitest';
import { computeCropPreviewLayout, computeCropRect } from '../lib/photoCrop';

describe('computeCropRect', () => {
  it('keeps crop within image bounds', () => {
    const rect = computeCropRect(1200, 800, {
      zoom: 2,
      offsetX: 100,
      offsetY: -100,
    });

    expect(rect.sx).toBeGreaterThanOrEqual(0);
    expect(rect.sy).toBeGreaterThanOrEqual(0);
    expect(rect.sx + rect.sSize).toBeLessThanOrEqual(1200);
    expect(rect.sy + rect.sSize).toBeLessThanOrEqual(800);
  });

  it('uses full shorter side when zoom is 1', () => {
    const rect = computeCropRect(900, 700, {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });

    expect(rect.sSize).toBe(700);
  });

  it('can align a portrait crop to the top to preserve the whole head', () => {
    const rect = computeCropRect(900, 1200, {
      zoom: 1,
      offsetX: 0,
      offsetY: -100,
    });

    expect(rect.sy).toBe(0);
    expect(rect.sSize).toBe(900);
  });

  it('uses the same crop rectangle for the preview and exported image', () => {
    const settings = { zoom: 1.5, offsetX: 40, offsetY: -60 };
    const rect = computeCropRect(900, 1200, settings);
    const layout = computeCropPreviewLayout(900, 1200, settings, 220);
    const previewScale = 220 / rect.sSize;

    expect(-layout.left / previewScale).toBeCloseTo(rect.sx);
    expect(-layout.top / previewScale).toBeCloseTo(rect.sy);
    expect(layout.width / previewScale).toBeCloseTo(900);
    expect(layout.height / previewScale).toBeCloseTo(1200);
  });
});
