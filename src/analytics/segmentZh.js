/**
 * @fileoverview Text segmentation — `Intl.Segmenter`, with graceful
 * degradation.
 *
 * The legacy tokenizer (`tokenize.js`) splits on whitespace + a Latin regex
 * (mangling contractions: "don't" → 'don') and emits overlapping character
 * bigrams for CJK runs: no word boundaries, no dictionary, and fragment
 * noise like '度學' next to '深度學習'. `Intl.Segmenter` (V8/ICU, built into
 * every evergreen browser and Node ≥ 16) provides dictionary-grade word
 * boundaries for EVERY language with zero bundle cost and no network
 * access, which fits the app's offline client-side contract.
 *
 * This module is the ONLY place that touches `Intl.Segmenter`, and
 * `segmentWords` is the universal splitter: policy-free (isWordLike segments,
 * lowercased — stopwords, length, and digit filters belong to the caller,
 * applied in `keywords.js`). Unlike the lazily chunked `compromise` engine,
 * nothing here needs a loading state — when the runtime lacks the API (or
 * the locale's dictionary), callers fall back to the legacy tokenizer
 * (`tokenize.js`; see `wordcloud.js`).
 *
 * Latin/ASCII runs inside CJK text (e.g. 'AI' in 'AI與人工智慧') come back
 * as plain words so the caller can route them into the same lemma namespace
 * as English documents.
 */

import { cjkStopsetFor } from './stopwords.js';
import { MIN_TOKEN_LENGTH } from './constants.js';

/** Memoized `Intl.Segmenter` instances, keyed by locale ('en' | 'zh' | 'ja'). */
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
 * Whether the runtime can segment text in the given locale at all. Callers
 * use this to pick between the segmenter path and the legacy tokenizer
 * before extracting.
 *
 * @param {string} lang segmenter locale: 'en' | 'zh' | 'ja'
 * @returns {boolean}
 */
export function segmentationAvailable(lang) {
  return segmenterFor(lang) !== null;
}

/**
 * Whether the runtime can segment Chinese at all — thin locale-specific
 * alias of `segmentationAvailable`. NO production callers (the word cloud
 * uses `segmentationAvailable(lang)` directly); kept only for the
 * `segment-zh` and `segment-words` suites, so retiring it means updating
 * those two imports — a separate, deliberate cleanup.
 *
 * @returns {boolean}
 */
export function zhSegmentationAvailable() {
  return segmentationAvailable('zh');
}

/**
 * A lowercased Latin/ASCII word — routed to the English lemma path.
 * Exported because the caller (`keywords.js`) needs the same predicate to
 * split segments into Latin vs CJK routing.
 */
export const LATIN_WORD = /^[a-z0-9']+$/;

/**
 * Segment text into words — the universal splitter for every language.
 *
 * Contract: `isWordLike` segments only (drops punctuation and spacing
 * fragments), lowercased, in source order. Deliberately policy-free: no
 * stopword, length, or digit filtering happens here, so one splitter serves
 * callers with different noise policies (English keywords in `keywords.js`,
 * the CJK wrapper below).
 *
 * @param {string} text
 * @param {string} lang segmenter locale: 'en' | 'zh' | 'ja'
 * @returns {string[]} word segments in source order
 */
export function segmentWords(text, lang) {
  const segmenter = segmenterFor(lang);
  if (!segmenter || !text) return [];

  const words = [];
  for (const { segment, isWordLike } of segmenter.segment(text)) {
    if (isWordLike) words.push(segment.toLowerCase());
  }
  return words;
}

/**
 * Segment CJK text into words — `segmentWords` plus the CJK noise policy.
 *
 * Policy (applied here because it is CJK-specific):
 * - Latin runs pass through untouched — the caller applies the English
 *   stopword/length/digit policy and lemma grouping.
 * - CJK words shorter than `MIN_TOKEN_LENGTH` (single function words like
 *   '的', '了', and single kana particles) and entries from the
 *   language-routed stop set (`cjkStopsetFor(locale)` — Japanese gets its
 *   own list) are dropped, mirroring the legacy path's noise filters.
 *
 * @param {string} text
 * @param {string} locale segmenter locale, 'zh' (default) or 'ja'
 * @returns {string[]} word segments in source order
 */
export function segmentCjkWords(text, locale = 'zh') {
  const stopset = cjkStopsetFor(locale);
  const words = [];
  for (const word of segmentWords(text, locale)) {
    if (LATIN_WORD.test(word)) {
      words.push(word);
    } else if (word.length >= MIN_TOKEN_LENGTH && !stopset.has(word)) {
      words.push(word);
    }
  }
  return words;
}
