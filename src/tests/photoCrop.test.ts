import { describe, expect, it } from 'vitest';
import { computeCropRect } from '../lib/photoCrop';

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
});
