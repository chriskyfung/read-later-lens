/**
 * @fileoverview Word-cloud computation.
 *
 * Pure aggregation: `wordCloudFrequencies` builds the term frequency list; the
 * DOM side (creating `<span>` nodes) lives in `renderWordCloud`
 * (`src/views/wordcloud.js`), so this module stays testable without a DOM.
 * Matches the original monolith behaviour (top 60 terms, size ratio
 * 0.75 + (count/max)*1.5).
 *
 * Term extraction is routed per document by `detectLanguage`:
 * - English documents go through `keywords.js` (compromise): nouns and
 *   noun-phrase topics, grouped by lemma, displayed by their most frequent
 *   surface form.
 * - CJK documents keep the legacy bigram path (`tokenize.js`), unchanged.
 *
 * The returned list carries `[[display, count], …]` — never a raw lemma — so
 * the click-to-search round-trip in the view always issues a verbatim
 * substring query.
 */

import { bookmarkText, tokenizeFrequency } from './tokenize.js';
import { detectLanguage } from './detectLanguage.js';
import { extractKeywordTerms, keywordsReady } from './keywords.js';

/**
 * Aggregate one document's terms into the running maps.
 *
 * @param {{ lemmas: Map<string, {count: number,
 *   surfaces: Map<string, number>}>, plain: Map<string, number> }} acc
 * @param {string} text
 */
function accumulate(acc, text) {
  const lang = detectLanguage(text);
  if (lang === 'en' && keywordsReady()) {
    for (const { key, display, count } of extractKeywordTerms(text)) {
      let group = acc.lemmas.get(key);
      if (!group) {
        group = { count: 0, surfaces: new Map() };
        acc.lemmas.set(key, group);
      }
      group.count += count;
      group.surfaces.set(display, (group.surfaces.get(display) || 0) + count);
    }
  } else {
    // CJK path (and English documents when the engine has not loaded) —
    // surface forms only, grouped by the token itself.
    for (const [t, n] of tokenizeFrequency(text)) {
      acc.plain.set(t, (acc.plain.get(t) || 0) + n);
    }
  }
}

/**
 * Most frequent surface form of a lemma group; ties break to the first-seen
 * surface so the choice is stable across renders.
 *
 * @param {Map<string, number>} surfaces
 * @returns {string}
 */
function displayFor(surfaces) {
  let best = '';
  let bestCount = -1;
  for (const [surface, count] of surfaces) {
    if (count > bestCount) {
      best = surface;
      bestCount = count;
    }
  }
  return best;
}

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} list
 * @returns {Array<[string, number]>} sorted desc by count, capped at 60.
 *   The term is the display form (a verbatim substring of the source text).
 */
export function wordCloudFrequencies(list) {
  const acc = { lemmas: new Map(), plain: new Map() };

  for (const b of list) {
    accumulate(acc, bookmarkText(b));
  }

  const entries = [
    ...[...acc.lemmas].map(([, group]) => [displayFor(group.surfaces), group.count]),
    ...[...acc.plain],
  ];

  return entries.sort((a, b) => b[1] - a[1]).slice(0, 60);
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
