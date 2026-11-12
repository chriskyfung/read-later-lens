/**
 * Tests for word-cloud computation — aggregation, sorting, and sizing.
 *
 * Colocated beside src/analytics/wordcloud.js per the project's hybrid
 * test arrangement (AGENTS.md).
 *
 * Original location: tests/analytics.test.js (wordcloud).
 */
import { describe, it, expect } from 'vitest';
import { wordCloudFrequencies, wordCloudItems } from './wordcloud.js';

describe('wordCloudFrequencies', () => {
  it('aggregates and sorts desc, capped at 60', () => {
    const bms = Array.from({ length: 70 }, (_, i) => ({
      id: String(i),
      title: `word${i} common`,
      article_preview: 'common',
    }));
    const freq = wordCloudFrequencies(bms);
    expect(freq.length).toBeLessThanOrEqual(60);
    expect(freq[0][0]).toBe('common');
    for (let i = 1; i < freq.length; i++) {
      expect(freq[i - 1][1]).toBeGreaterThanOrEqual(freq[i][1]);
    }
  });

  it('returns [] for empty input', () => {
    expect(wordCloudFrequencies([{ id: 'x', title: '  the ', article_preview: '' }])).toEqual([]);
  });
});

describe('wordCloudItems', () => {
  it('computes sizeRatio 0.75..2.25', () => {
    const items = wordCloudItems([
      ['hi', 10],
      ['lo', 0],
    ]);
    expect(items[0].sizeRatio).toBeCloseTo(2.25);
    expect(items[1].sizeRatio).toBeCloseTo(0.75);
  });
});
