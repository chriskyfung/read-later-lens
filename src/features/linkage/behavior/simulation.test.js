import { describe, it, expect } from 'vitest';
import {
  linkStrokeWidth,
  LINK_STROKE_MIN,
  LINK_STROKE_MAX,
  LINK_STROKE_RANGE,
} from './simulation.js';

/**
 * Tests for linkStrokeWidth, the pure function that maps link similarity to
 * rendered stroke width. Extracted so the geometry rule is testable without a
 * canvas or d3 simulation.
 */

describe('link stroke width constants', () => {
  it('exports the stroke width range constants', () => {
    expect(LINK_STROKE_MIN).toBe(1);
    expect(LINK_STROKE_MAX).toBe(4);
    expect(LINK_STROKE_RANGE).toBe(LINK_STROKE_MAX - LINK_STROKE_MIN);
  });
});

describe('linkStrokeWidth', () => {
  it('maps cosine 0 to the minimum stroke width', () => {
    expect(linkStrokeWidth(0)).toBe(1);
  });

  it('maps cosine 1 to the maximum stroke width', () => {
    expect(linkStrokeWidth(1)).toBe(4);
  });

  it('scales linearly between the extremes', () => {
    expect(linkStrokeWidth(0.5)).toBeCloseTo(2.5);
    expect(linkStrokeWidth(0.25)).toBeCloseTo(1.75);
  });

  it('clamps below-range values to the floor', () => {
    expect(linkStrokeWidth(-1)).toBe(1);
    expect(linkStrokeWidth(-0.5)).toBe(1);
  });

  it('clamps above-range values to the ceiling', () => {
    expect(linkStrokeWidth(2)).toBe(4);
    expect(linkStrokeWidth(1.5)).toBe(4);
  });

  it('treats undefined as zero (floor)', () => {
    expect(linkStrokeWidth(undefined)).toBe(1);
  });
});
