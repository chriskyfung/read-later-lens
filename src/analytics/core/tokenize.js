/**
 * @fileoverview Legacy text-analysis path — the DECLARED FALLBACK splitter
 * and the home of `simpleStem`.
 *
 * Declared roles (the universal `Intl.Segmenter` splitter in
 * `segmentZh.js` took over every primary path):
 * - Fallback for runtimes without `Intl.Segmenter`: the word cloud falls
 *   back to this tokenizer for every language when the built-in API is
 *   absent, and CJK documents also land here after a compromise chunk
 *   failure so plain-path keys stay coherent across languages.
 * - `simpleStem` additionally survives as the pre-engine / plain-path
 *   grouping key (see its JSDoc).
 *
 * TF-IDF similarity used to tokenize here too; it migrated to the
 * universal splitter (`extractPlainTerms`), divergences pinned in
 * tests/similarity-segmenter.test.js. The word-cloud fallback above is
 * now the only splitter consumer — and it cannot be deleted: the
 * declared browser-support floor promises "degrades, never crashes", so
 * a runtime without Intl.Segmenter must keep getting terms from
 * somewhere. There is no dictionary-grade splitter to upgrade it to;
 * deleting this file would turn graceful degradation into a broken
 * cloud.
 *
 * Behaviour here stays byte-compatible with the original monolith;
 * pinned by tests/analytics.test.js and tests/tokenize-legacy.test.js.
 */

import { CLOUD_EN, CJK_STOPWORDS } from './stopwords.js';
import {
  INVALID_CHARS,
  CJK_CHAR,
  ENGLISH_TOKEN,
  DIGITS_ONLY,
  MIN_TOKEN_LENGTH,
  WHITESPACE,
} from './constants.js';

/**
 * Light English stemmer (original behaviour, preserved).
 *
 * LOAD-BEARING — do not delete this alongside the legacy splitter. It is
 * the grouping key for Latin runs inside CJK documents before the
 * compromise engine arrives (`latinKeyFor` in keywords.js) and the
 * key = display contract of `extractPlainTerms` (the word-cloud English
 * plain path and TF-IDF similarity), where the universal splitter
 * provides the word boundaries but this stemmer still provides the
 * grouping. Pinned by tests/tokenize-legacy.test.js.
 *
 * @param {string} word
 * @returns {string}
 */
export function simpleStem(word) {
  if (word.length < 4) return word;
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) return word.slice(0, -1);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  return word;
}

/**
 * Tokenize text into keyword fragments for frequency analysis.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeText(text) {
  if (!text) return [];
  const cleaned = text.toLowerCase().replace(INVALID_CHARS, ' ');
  const rawTokens = cleaned.split(WHITESPACE);
  const tokens = [];

  for (const word of rawTokens) {
    if (!word || word.length < MIN_TOKEN_LENGTH) continue;

    // English-like token
    if (ENGLISH_TOKEN.test(word)) {
      if (!CLOUD_EN.has(word) && !DIGITS_ONLY.test(word)) {
        tokens.push(simpleStem(word));
      }
    } else if (CJK_CHAR.test(word)) {
      // CJK / CJK-mixed token — emit bigrams
      for (let i = 0; i < word.length - 1; i++) {
        const bigram = word.substring(i, i + 2);
        if (!CJK_STOPWORDS.has(bigram)) {
          tokens.push(bigram);
        }
      }
    }
  }
  return tokens;
}

/**
 * Build a frequency map from tokenized text.
 *
 * @param {string} text
 * @returns {Map<string, number>}

/**
 * Text source for frequency analysis: bookmark title + plain-text preview.
 * Single definition so field renames/additions happen in one place.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 * @returns {string}
 */
export function bookmarkText(b) {
  return (b.title || '') + ' ' + (b.article_preview || '');
}

export function tokenizeFrequency(text) {
  const freq = new Map();
  for (const t of tokenizeText(text)) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return freq;
}
