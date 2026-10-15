/**
 * @fileoverview CJK word segmentation — `Intl.Segmenter`, with graceful
 * degradation.
 *
 * The legacy tokenizer (`tokenize.js`) emits overlapping character bigrams
 * for CJK runs: no word boundaries, no dictionary, and fragment noise like
 * '度學' next to '深度學習'. `Intl.Segmenter` (V8/ICU, built into every
 * evergreen browser and Node ≥ 16) provides dictionary-grade word
 * boundaries with zero bundle cost and no network access, which fits the
 * app's offline client-side contract.
 *
 * This module is the ONLY place that touches `Intl.Segmenter`. It is
 * synchronous and dependency-free on purpose: unlike the lazily chunked
 * `compromise` engine, nothing here needs a loading state — when the
 * runtime lacks the API (or the locale's dictionary), callers fall back to
 * the legacy bigram path in `tokenize.js` (see `wordcloud.js`).
 *
 * Segments are returned lowercased. Latin/ASCII runs inside CJK text (e.g.
 * 'AI' in 'AI與人工智慧') come back as plain words so the caller can route
 * them into the same lemma namespace as English documents.
 */

import { CJK_STOPWORDS } from './stopwords.js';
import { MIN_TOKEN_LENGTH } from './constants.js';

/** Memoized `Intl.Segmenter` instances, keyed by locale ('zh' | 'ja'). */
const segmenters = new Map();

/**
 * @param {string} locale
 * @returns {Intl.Segmenter|null}
 */
function segmenterFor(locale) {
  let segmenter = segmenters.get(locale);
  if (segmenter === undefined) {
    try {
      segmenter =
        typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
          ? new Intl.Segmenter(locale, { granularity: 'word' })
          : null;
    } catch {
      segmenter = null;
    }
    segmenters.set(locale, segmenter);
  }
  return segmenter;
}

/**
 * Whether the runtime can segment Chinese at all. Callers use this to pick
 * between the segmenter path and the legacy bigram path before extracting.
 *
 * @returns {boolean}
 */
export function zhSegmentationAvailable() {
  return segmenterFor('zh') !== null;
}

/**
 * A lowercased Latin/ASCII word — routed to the English lemma path.
 * Exported because the caller (`keywords.js`) needs the same predicate to
 * split segments into Latin vs CJK routing.
 */
export const LATIN_WORD = /^[a-z0-9']+$/;

/**
 * Segment CJK text into words.
 *
 * Policy:
 * - `isWordLike` segments only (drops punctuation and spacing fragments).
 * - Lowercased, so a Latin run ('AI', 'Google') merges with the same word
 *   from English documents under the click-to-search substring matcher.
 * - Latin runs pass through untouched here — the caller applies the English
 *   stopword/length/digit policy and lemma grouping.
 * - CJK words shorter than `MIN_TOKEN_LENGTH` (single function words like
 *   '的', '了') and entries from the shared `CJK_STOPWORDS` list are dropped,
 *   mirroring the legacy path's noise filters.
 *
 * @param {string} text
 * @param {string} locale segmenter locale, 'zh' (default) or 'ja'
 * @returns {string[]} word segments in source order
 */
export function segmentCjkWords(text, locale = 'zh') {
  const segmenter = segmenterFor(locale);
  if (!segmenter || !text) return [];

  const words = [];
  for (const { segment, isWordLike } of segmenter.segment(text)) {
    if (!isWordLike) continue;
    const word = segment.toLowerCase();
    if (LATIN_WORD.test(word)) {
      words.push(word);
    } else if (word.length >= MIN_TOKEN_LENGTH && !CJK_STOPWORDS.has(word)) {
      words.push(word);
    }
  }
  return words;
}
