/**
 * @fileoverview Worker-scoped keyword term extraction.
 *
 * Mirrors `src/analytics/extract.js` but with its own lazy `compromise`
 * loader, so the worker never touches the main thread's engine state.
 *
 * Pure extraction — no DOM, no main-thread imports beyond the small
 * constant/utility modules re-exported via ./constants.js.
 */

import {
  MIN_TOKEN_LENGTH,
  DIGITS_ONLY,
  LATIN_WORD,
  BASE_EN,
  CLOUD_EN,
  cjkStopsetFor,
  simpleStem,
} from './constants.js';
import { segmentCjkWords, segmentWords } from '../core/segmentZh.js';

/** Strips everything a term must not keep: punctuation, spaces, CJK runs. */
const TERM_CLEAN = /[^a-z0-9']+/g;

function cleanWord(word) {
  return word.toLowerCase().replace(TERM_CLEAN, '');
}

/**
 * @param {string} word
 * @param {ReadonlySet<string>} stopset
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

/** Worker-local `compromise` engine state. */
let workerNlp = null;
let _workerEngineState = 'idle';
let workerEnginePromise = null;

/**
 * Load `compromise` inside the worker. Idempotent: every caller shares one
 * promise, and a failed load resolves to null instead of rejecting.
 * @returns {Promise<Function|null>}
 */
async function loadWorkerEngine() {
  if (_workerEngineState === 'ready') return workerNlp;
  if (_workerEngineState === 'failed') return null;
  if (_workerEngineState === 'loading') return workerEnginePromise;

  _workerEngineState = 'loading';
  workerEnginePromise = import('compromise')
    .then((mod) => {
      workerNlp = mod.default ?? mod;
      _workerEngineState = 'ready';
      return workerNlp;
    })
    .catch((err) => {
      console.warn('Worker: keyword engine failed to load:', err);
      _workerEngineState = 'failed';
      return null;
    });
  return workerEnginePromise;
}

/** @returns {Function|null} The loaded `compromise` function, or null. */
function getWorkerNlp() {
  return workerNlp;
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
  const nlp = getWorkerNlp();
  if (!nlp) return word;
  let lemma = lemmaCache.get(word);
  if (lemma === undefined) {
    lemma = nlp(word).normalize({ plurals: true, verbs: true }).text().trim().toLowerCase();
    lemmaCache.set(word, lemma);
  }
  return lemma || word;
}

/**
 * Grouping key for a Latin run inside a CJK document: the compromise lemma
 * once the engine is loaded, the legacy stemmer until then.
 *
 * @param {string} word lowercased surface form
 * @returns {string}
 */
function latinKeyFor(word) {
  const nlp = getWorkerNlp();
  return nlp ? lemmaOf(word) : simpleStem(word);
}

/**
 * Extract keyword terms from English text using `compromise`.
 *
 * Two passes over `compromise`'s POS tags:
 * - **Unigrams** — every `#Noun` occurrence.
 * - **Noun-phrase bigrams** — adjacent `#Noun #Noun` pairs.
 *
 * @param {string} text
 * @returns {{ key: string, display: string, count: number }[]}
 */
export function extractKeywordTerms(text) {
  const nlp = getWorkerNlp();
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
 * caller-selected noise policy and the legacy stem key.
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
 * with the CLOUD stopset.
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
 * built-in `Intl.Segmenter` (see `segmentZh.js`).
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
    terms.push({
      key: LATIN_WORD.test(word) ? latinKeyFor(word) : word,
      display: word,
      count: 1,
    });
  }
  return terms;
}

/**
 * Expose the engine loader so `aggregate.js` can check worker engine state
 * without importing `engine.js` (which has main-thread-only module state).
 * @returns {{ state: 'idle'|'loading'|'ready'|'failed', nlp: Function|null }}
 */
export function workerEngineState() {
  return { state: _workerEngineState, nlp: workerNlp };
}

/**
 * Ensure the worker engine is loading (caller can fire-and-forget).
 * @returns {Promise<Function|null>}
 */
export function preloadWorkerEngine() {
  return loadWorkerEngine();
}
