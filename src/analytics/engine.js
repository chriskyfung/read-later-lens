/**
 * @fileoverview Keyword engine lifecycle — lazy loader for `compromise`.
 *
 * The ONLY place that imports `compromise` (dynamically). Holds the engine
 * state (`engineState`, `nlp`, `pending`) and the document-language routing
 * helpers. Extraction logic lives in `./extract.js`, which reads the loaded
 * engine through `getNlp()`.
 */

import { bookmarkText } from './core/tokenize.js';
import { detectLanguage } from './core/detectLanguage.js';

/** Engine lifecycle state. */
let engineState = 'idle';
/** The loaded `compromise` function, or null until ready. */
let nlp = null;
/** The in-flight (or settled) load promise. */
let pending = null;

/** Memoized document language per bookmark. */
const languageMemo = new WeakMap();

/**
 * Load the keyword engine on demand. Idempotent: every caller shares one
 * promise, and a failed load resolves to null (state 'failed') instead of
 * rejecting, so a broken chunk degrades to the legacy tokenizer rather than
 * an unhandled rejection or a reload loop.
 *
 * @returns {Promise<Function|null>}
 */
export function loadKeywordsEngine() {
  if (engineState === 'ready') return Promise.resolve(nlp);
  if (engineState === 'failed') return Promise.resolve(null);
  if (engineState === 'loading') return pending;

  engineState = 'loading';
  pending = import('compromise')
    .then((mod) => {
      nlp = mod.default ?? mod;
      engineState = 'ready';
      return nlp;
    })
    .catch((err) => {
      console.warn('Keyword engine failed to load:', err);
      engineState = 'failed';
      return null;
    });
  return pending;
}

/**
 * @returns {boolean} True once the engine is loaded and usable.
 */
export function keywordsReady() {
  return engineState === 'ready';
}

/**
 * @returns {boolean} True once the engine chunk failed to load. Callers
 *   treat it as "degrade to the legacy tokenizer" for EVERY language —
 *   English and CJK documents must then share one namespace, because their
 *   stem and lemma keys disagree on some words ('runn' vs 'run') and would
 *   split one word back into two cloud rows.
 */
export function keywordsFailed() {
  return engineState === 'failed';
}

export function getNlp() {
  return nlp;
}

export function getEngineState() {
  return engineState;
}

/**
 * Detected language of a bookmark's analysis text, memoized per record.
 *
 * @param {import('../../core/model/BookmarkRecord.js').BookmarkRecord} b
 * @returns {string}
 */
export function documentLanguage(b) {
  let lang = languageMemo.get(b);
  if (lang === undefined) {
    lang = detectLanguage(bookmarkText(b));
    languageMemo.set(b, lang);
  }
  return lang;
}

/**
 * Whether the given bookmarks need the (lazily loaded) engine at all: only
 * English-routed documents do. A CJK-only library never downloads the
 * chunk — it segments with the built-in `Intl.Segmenter` instead (see
 * `extractCjkKeywordTerms`) — so `loadKeywordsEngine()` stays untouched.
 *
 * @param {import('../../core/model/BookmarkRecord.js').BookmarkRecord[]} list
 * @returns {boolean}
 */
export function needsKeywordEngine(list) {
  if (engineState === 'ready' || engineState === 'failed') return false;
  return list.some((b) => documentLanguage(b) === 'en');
}
