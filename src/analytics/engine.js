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

export function keywordsReady() {
  return engineState === 'ready';
}

export function keywordsFailed() {
  return engineState === 'failed';
}

export function getNlp() {
  return nlp;
}

export function getEngineState() {
  return engineState;
}

export function documentLanguage(b) {
  let lang = languageMemo.get(b);
  if (lang === undefined) {
    lang = detectLanguage(bookmarkText(b));
    languageMemo.set(b, lang);
  }
  return lang;
}

export function needsKeywordEngine(list) {
  if (engineState === 'ready' || engineState === 'failed') return false;
  return list.some((b) => documentLanguage(b) === 'en');
}
