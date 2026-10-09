/**
 * @fileoverview Word-cloud computation.
 *
 * Pure aggregation: `wordCloudFrequencies` builds the term frequency list; the
 * DOM side (creating `<span>` nodes) lives in `renderWordCloud`
 * (`src/views/wordcloud.js`), so this module stays testable without a DOM.
 * Matches the original monolith behaviour (top 60 terms, size ratio
 * 0.75 + (count/max)*1.5).
 */

import { bookmarkText, tokenizeFrequency } from './tokenize.js';

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} bookmarks
 * @returns {Array<[string, number]>} sorted desc by count, capped at 60
 */
export function wordCloudFrequencies(list) {
  const freq = new Map();
  for (const b of list) {
    for (const [t, n] of tokenizeFrequency(bookmarkText(b))) {
      freq.set(t, (freq.get(t) || 0) + n);
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60);
}

/**
 * @param {Array<[string, number]>} sorted
 * @returns {{ word: string, count: number, sizeRatio: number }[]}
 */
export function wordCloudItems(sorted) {
  if (sorted.length === 0) return [];
  const maxCount = sorted[0][1];
  return sorted.map(([word, count]) => ({
    word,
    count,
    sizeRatio: 0.75 + (count / maxCount) * 1.5,
  }));
}
