import { describe, expect, it } from 'vitest';
import { computeFitScale } from '../lib/fitScale';
import { normalizeResumeFontSize } from '../types/resume';

describe('computeFitScale', () => {
  it('returns 1 when content is shorter than page', () => {
    expect(computeFitScale(800, 1000)).toBe(1);
  });

  it('returns 1 when content height equals page height', () => {
    expect(computeFitScale(1000, 1000)).toBe(1);
  });

  it('returns ratio when content exceeds page height', () => {
    expect(computeFitScale(1500, 1000)).toBeCloseTo(0.667, 3);
  });

  it('enforces minimum scale floor', () => {
    expect(computeFitScale(4000, 1000)).toBe(0.5);
  });
});

describe('normalizeResumeFontSize', () => {
  it('clamps font size to the supported range', () => {
    expect(normalizeResumeFontSize(8)).toBe(9);
    expect(normalizeResumeFontSize(14)).toBe(13);
  });

  it('falls back to the default for invalid values', () => {
    expect(normalizeResumeFontSize(undefined)).toBe(11);
    expect(normalizeResumeFontSize('not-a-size')).toBe(11);
  });
});
