/**
 * @fileoverview Keyword term extraction.
 *
 * Pure extraction functions (compromise-backed English terms, plain splitter
 * terms, CJK terms) plus helpers. Reads the loaded engine via `getNlp()`
 * from `./engine.js` so the lazy-loading lifecycle stays isolated.
 */

import { simpleStem } from './core/tokenize.js';
import { BASE_EN, CLOUD_EN, cjkStopsetFor } from './core/stopwords.js';
import { DIGITS_ONLY, MIN_TOKEN_LENGTH } from './core/constants.js';
import { segmentCjkWords, segmentWords, LATIN_WORD } from './core/segmentZh.js';
import { getNlp } from './engine.js';

/** Strips everything a term must not keep: punctuation, spaces, CJK runs. */
const TERM_CLEAN = /[^a-z0-9']+/g;

function cleanWord(word) {
  return word.toLowerCase().replace(TERM_CLEAN, '');
}

/**
 * @param {string} word
 * @param {ReadonlySet<string>} stopset which noise policy to apply
 * @returns {boolean} True when the word is too short, numeric, or a stopword.
 */
function isNoise(word, stopset) {
  return word.length < MIN_TOKEN_LENGTH || DIGITS_ONLY.test(word) || stopset.has(word);
}

/**
 * Clean a match's words and trim noise from both edges. Interior stopwords
 * are deliberately kept: the display form must stay a verbatim substring of
 * the source text for click-to-search to round-trip. Uses the CLOUD set —
 * this only runs on the compromise (word-cloud) path.
 *
 * @param {string[]} words
 * @returns {string[]}
 */
function trimEdges(words) {
  let start = 0;
  let end = words.length;
  while (start < end && isNoise(words[start], CLOUD_EN)) start++;
  while (end > start && isNoise(words[end - 1], CLOUD_EN)) end--;
  return words.slice(start, end);
}

/**
 * @param {string} raw @returns {string[]}
 */
function splitClean(raw) {
  return raw.split(/\s+/).map(cleanWord).filter(Boolean);
}

/**
 * Lemma of a single cleaned word, memoized module-wide: `compromise`
 * normalizes one word at a time, and titles/previews repeat the same nouns
 * constantly, so the cache keeps the per-document cost at one parse plus a
 * few cheap normalizations.
 *
 * @type {Map<string, string>}
 */
const lemmaCache = new Map();

/**
 * @param {string} word cleaned surface form
 * @returns {string} lemma (grouping key only — never rendered)
 */
function lemmaOf(word) {
  const nlp = getNlp();
  let lemma = lemmaCache.get(word);
  if (lemma === undefined) {
    lemma = nlp(word).normalize({ plurals: true, verbs: true }).text().trim().toLowerCase();
    lemmaCache.set(word, lemma);
  }
  return lemma || word;
}

/**
 * Grouping key for a Latin run inside a CJK document: the compromise lemma
 * once the engine is loaded, the legacy stemmer until then (a CJK-only
 * library has no English rows to disagree with, and the cloud view blocks a
 * MIXED list behind the loading placeholder). The caller's memo is keyed on
 * the extraction mode, so entries recompute when the engine arrives and the
 * key switches; the display merge hides any transient seam.
 *
 * @param {string} word lowercased surface form
 * @returns {string}
 */
function latinKeyFor(word) {
  const nlp = getNlp();
  return nlp ? lemmaOf(word) : simpleStem(word);
}

/**
 * Extract keyword terms from English text.
 *
 * Two passes over `compromise`'s POS tags:
 * - **Unigrams** — every `#Noun` occurrence. Repeated words stay separate
 *   occurrences (the greedy `#Noun+` run would otherwise swallow
 *   "running running running runs" into one useless mega-term).
 * - **Noun-phrase bigrams** — adjacent `#Noun #Noun` pairs, giving real topics
 *   like "machine learning". Unigrams inside a bigram are also counted as
 *   unigrams: that is the standard n-gram word-cloud contract, so the cloud
 *   shows both the phrase and its parts.
 *
 * Each term carries a display form that is a verbatim (case-insensitive,
 * edge-trimmed) substring of the source text, so the word-cloud
 * click-to-search round-trip keeps working against the plain substring
 * matcher in `src/core/filters.js`. The lemma is only ever an internal
 * grouping key; it must never reach the DOM (see `wordcloud.js`).
 *
 * @param {string} text
 * @returns {{ key: string, display: string, count: number }[]}
 */
export function extractKeywordTerms(text) {
  const nlp = getNlp();
  if (!nlp || !text) return [];

  const doc = nlp(text);
  const terms = [];

  for (const raw of doc.match('#Noun').out('array')) {
    const [word] = trimEdges(splitClean(raw));
    if (word) terms.push({ key: lemmaOf(word), display: word, count: 1 });
  }

  for (const { normal, count } of doc.match('#Noun #Noun').out('freq')) {
    const words = trimEdges(splitClean(normal));
    if (words.length < 2 || words[0] === words[1]) continue;
    const display = words.join(' ');
    terms.push({ key: words.map(lemmaOf).join(' '), display, count });
  }

  return terms;
}

/**
 * Plain-path terms — the universal splitter (`segmentWords`) plus the
 * caller-selected noise policy and the legacy stem key. THE tokenizer
 * behind both the word-cloud English plain path and TF-IDF similarity
 * (every language, routed by `documentLanguage`).
 *
 * Two stopsets, one code path:
 * - **Scorer default (`BASE_EN`)** — similarity/linkage keep content-ish
 *   words ('time', 'new', 'way') because two docs sharing "time
 *   management" ARE similar.
 * - **Cloud (`CLOUD_EN` via `extractPlainEnglishTerms`)** — the aesthetic
 *   overlay hides those words from the display.
 *
 * Grouping contract, same as `tokenizeFrequency` before it: key =
 * display. Latin words key on `simpleStem`; CJK words key on themselves.
 * A possessive "'s" is stripped first so "Google's" keeps its legacy
 * token identity ('google', not a trailing-apostrophe stem). Policy per
 * script:
 * - Latin: `isNoise` (length, digits, `stopset`) — ICU keeps
 *   contractions whole, so "don't" is dropped by the stopword list where
 *   the legacy regex invented a phantom 'don' token.
 * - CJK: `MIN_TOKEN_LENGTH` + `cjkStopsetFor(lang)`, mirroring
 *   `segmentCjkWords`.
 *
 * Callers without `Intl.Segmenter` fall back to `tokenizeFrequency`
 * (see `wordcloud.js`).
 *
 * @param {string} text
 * @param {string} lang 'en' (default) | 'zh' | 'ja'
 * @param {ReadonlySet<string>} [stopset=BASE_EN] Latin-word noise policy
 * @returns {[string, number][]} [term, count] pairs in first-seen order
 */
export function extractPlainTerms(text, lang = 'en', stopset = BASE_EN) {
  if (!text) return [];

  const freq = new Map();
  for (const raw of segmentWords(text, lang)) {
    const word = raw.replace(/'s$/, '');
    if (!word) continue;
    if (LATIN_WORD.test(word)) {
      if (isNoise(word, stopset)) continue;
      const term = simpleStem(word);
      freq.set(term, (freq.get(term) || 0) + 1);
    } else {
      if (word.length < MIN_TOKEN_LENGTH || cjkStopsetFor(lang).has(word)) continue;
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }
  return [...freq];
}

/**
 * English shorthand for the word-cloud plain path — `extractPlainTerms`
 * with the CLOUD stopset, so aesthetic words stay hidden in the display.
 * See `extractPlainTerms` for the full contract.
 *
 * @param {string} text
 * @returns {[string, number][]} [term, count] pairs in first-seen order
 */
export function extractPlainEnglishTerms(text) {
  return extractPlainTerms(text, 'en', CLOUD_EN);
}

/**
 * Extract keyword terms from CJK-routed text.
 *
 * Works with or without the loaded compromise engine — it only needs the
 * built-in `Intl.Segmenter` (see `segmentZh.js`), so a Chinese-only library
 * never pays for the English chunk. Display forms are verbatim, lowercased
 * substrings of the source text, so the click-to-search contract holds.
 * Two routes:
 * - **Latin runs** ('ai', 'google' inside a Chinese document) group under
 *   the compromise lemma (the legacy stemmer before the engine arrives),
 *   merging with the same word from English documents — one cloud row per
 *   word, one summed count.
 * - **CJK words** group under themselves: Chinese has no inflectional
 *   lemma for compromise's English-only normalizer, and the surface form
 *   is already the topic the reader expects to see.
 *
 * @param {string} text
 * @param {string} locale 'zh' (default) or 'ja'
 * @returns {{ key: string, display: string, count: number }[]}
 */
export function extractCjkKeywordTerms(text, locale = 'zh') {
  if (!text) return [];
  const terms = [];
  for (const word of segmentCjkWords(text, locale)) {
    if (isNoise(word, CLOUD_EN)) continue;
    terms.push({ key: LATIN_WORD.test(word) ? latinKeyFor(word) : word, display: word, count: 1 });
  }
  return terms;
}
