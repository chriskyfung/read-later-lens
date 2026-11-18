/**
 * @fileoverview Tests for worker-scoped frequency aggregation.
 *
 * Colocated beside src/analytics/worker/aggregate.js per the project's
 * hybrid test arrangement. Tests `computeWordCloudFrequencies` and
 * `computeWordCloudItems` with serialized bookmark DTOs.
 *
 * The worker starts in 'idle' engine state (no `compromise` loaded), so
 * English documents route through the plain path and CJK documents route
 * through `Intl.Segmenter` when available. Tests assert structural
 * behaviour (sorting, capping, merging) rather than exact term values,
 * which depend on the runtime's segmentation support.
 */

import { describe, it, expect } from 'vitest';
import { computeWordCloudFrequencies, computeWordCloudItems } from './aggregate.js';

const dto = (id, title, preview, lang = 'en') => ({
  id,
  title: title || '',
  article_preview: preview || '',
  detected_language: lang,
});

describe('computeWordCloudFrequencies', () => {
  it('returns an empty array for an empty list', () => {
    expect(computeWordCloudFrequencies([])).toEqual([]);
  });

  it('returns terms sorted descending by count', () => {
    const list = [dto('1', 'apple apple banana', '', 'en'), dto('2', 'apple cherry', '', 'en')];
    const entries = computeWordCloudFrequencies(list);
    const counts = entries.map(([, c]) => c);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(entries[0][0]).toBe('apple');
    expect(entries[0][1]).toBeGreaterThan(entries[1][1]);
  });

  it('caps the result at 60 entries', () => {
    const list = [];
    for (let i = 0; i < 100; i++) {
      list.push(dto(`b${i}`, `uniqueword${i} term common`, '', 'en'));
    }
    const entries = computeWordCloudFrequencies(list);
    expect(entries.length).toBeLessThanOrEqual(60);
  });

  it('merges terms across English and CJK documents on display form', () => {
    const list = [
      dto('1', 'machine learning AI', '', 'en'),
      dto('2', 'AI 人工智能 機器學習', 'AI 人工智能 機器學習', 'zh'),
    ];
    const entries = computeWordCloudFrequencies(list);
    const words = new Set(entries.map(([w]) => w));
    // 'ai' should appear once, merged across both docs — keyed on display,
    // not on lemma/surface, so English and CJK instances share one row.
    expect(words.has('ai')).toBe(true);
    // There should not be two separate 'ai' rows.
    const aiRows = entries.filter(([w]) => w === 'ai');
    expect(aiRows.length).toBe(1);
    // The merged count should be >= 2 (one from each doc, possibly more
    // depending on how Intl.Segmenter splits the CJK text).
    expect(aiRows[0][1]).toBeGreaterThanOrEqual(2);
  });

  it('produces lowercase display forms', () => {
    const list = [dto('1', 'Apple Pie Recipe', '', 'en')];
    const entries = computeWordCloudFrequencies(list);
    for (const [word] of entries) {
      expect(word).toBe(word.toLowerCase());
    }
  });

  it('is deterministic across repeated calls with the same input', () => {
    const list = [dto('1', 'apple banana cherry apple', '', 'en')];
    const first = computeWordCloudFrequencies(list);
    const second = computeWordCloudFrequencies(list);
    expect(first).toEqual(second);
  });
});

describe('computeWordCloudItems', () => {
  it('returns an empty array for empty input', () => {
    expect(computeWordCloudItems([])).toEqual([]);
  });

  it('assigns sizeRatio between 0.75 and 2.25', () => {
    const sorted = [
      ['apple', 10],
      ['banana', 5],
      ['cherry', 1],
    ];
    const items = computeWordCloudItems(sorted);
    expect(items[0].sizeRatio).toBe(2.25); // max count
    expect(items[items.length - 1].sizeRatio).toBeGreaterThanOrEqual(0.75);
    expect(items[items.length - 1].sizeRatio).toBeLessThanOrEqual(2.25);
  });

  it('preserves word and count from input', () => {
    const sorted = [
      ['apple', 10],
      ['banana', 5],
    ];
    const items = computeWordCloudItems(sorted);
    expect(items[0]).toEqual({ word: 'apple', count: 10, sizeRatio: 2.25 });
    expect(items[1].word).toBe('banana');
    expect(items[1].count).toBe(5);
  });
});
