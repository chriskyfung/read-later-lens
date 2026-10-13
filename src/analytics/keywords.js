/**
 * @fileoverview English keyword extraction — lemmatized nouns + noun-phrase
 * topics, powered by the maintained `compromise` library.
 *
 * This module is the ONLY place that imports `compromise`, and it loads it
 * lazily via `loadKeywordsEngine()` so the library stays out of the initial
 * bundle: the word-cloud view calls `needsKeywordEngine()` first and only
 * pays for the chunk when the visible library actually contains English
 * documents. Lazy loading requires `codeSplitting` in `vite.config.js` —
 * without it the bundler inlines the dynamic import back into the entry
 * chunk.
 *
 * Engine states:
 * - idle: not requested yet
 * - loading: chunk in flight
 * - ready: extraction works
 * - failed: the chunk could not load; English documents then fall back to the
 *   legacy tokenizer (`tokenize.js`) rather than spinning on a loading state
 *
 * Extraction contract — every term carries a display form that is a verbatim
 * (case-insensitive, edge-trimmed) substring of the source text, so the
 * word-cloud click-to-search round-trip keeps working against the plain
 * substring matcher in `src/core/filters.js`. The lemma is only ever an
 * internal grouping key; it must never reach the DOM (see `wordcloud.js`).
 *
 * CJK documents are NOT handled here: `compromise` is English-only and treats
 * a CJK run as one giant noun, so language routing happens upstream in
 * `wordcloud.js` and CJK text keeps its existing bigram path in `tokenize.js`.
 */

import { bookmarkText } from './tokenize.js';
import { detectLanguage } from './detectLanguage.js';
import { ENGLISH_STOPWORDS } from './stopwords.js';
import { DIGITS_ONLY, MIN_TOKEN_LENGTH } from './constants.js';

/** Engine lifecycle state — see the fileoverview. */
let engineState = 'idle';
/** The loaded `compromise` function, or null until ready. */
let nlp = null;
/** The in-flight (or settled) load promise. */
let pending = null;

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

/** @returns {boolean} True once the engine is loaded and usable. */
export function keywordsReady() {
  return engineState === 'ready';
}

/**
 * Per-record memo of `detectLanguage`, keyed on the bookmark object itself.
 *
 * A WeakMap (not a text-keyed Map) because it cannot outlive its key: a
 * re-import replaces the record objects wholesale, so stale entries are
 * collected instead of pinned in memory with their full preview text. This is
 * safe only because no code mutates `title`/`article_preview` in place —
 * trash/restore and imports all build new record objects.
 *
 * @type {WeakMap<object, string>}
 */
const languageMemo = new WeakMap();

/**
 * Detected language of a bookmark's analysis text, memoized per record.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
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
 * English-routed documents do. A CJK-only library never downloads the chunk
 * and renders through the legacy bigram path.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} list
 * @returns {boolean}
 */
export function needsKeywordEngine(list) {
  if (engineState === 'ready' || engineState === 'failed') return false;
  return list.some((b) => documentLanguage(b) === 'en');
}

/** Strips everything a term must not keep: punctuation, spaces, CJK runs. */
const TERM_CLEAN = /[^a-z0-9']+/g;

/**
 * Normalize one whitespace-separated word of a match to its display form:
 * lowercase, alphanumeric+apostrophe only (drops trailing '.', ',' and any
 * stray CJK), or '' when nothing usable remains.
 *
 * @param {string} word
 * @returns {string}
 */
function cleanWord(word) {
  return word.toLowerCase().replace(TERM_CLEAN, '');
}

/**
 * @param {string} word
 * @returns {boolean} True when the word is too short, numeric, or a stopword.
 */
function isNoise(word) {
  return word.length < MIN_TOKEN_LENGTH || DIGITS_ONLY.test(word) || ENGLISH_STOPWORDS.has(word);
}

/**
 * Clean a match's words and trim noise from both edges. Interior stopwords
 * are deliberately kept: the display form must stay a verbatim substring of
 * the source text for click-to-search to round-trip.
 *
 * @param {string[]} words
 * @returns {string[]}
 */
function trimEdges(words) {
  let start = 0;
  let end = words.length;
  while (start < end && isNoise(words[start])) start++;
  while (end > start && isNoise(words[end - 1])) end--;
  return words.slice(start, end);
}

/** @param {string} raw @returns {string[]} */
function splitClean(raw) {
  return raw.split(/\s+/).map(cleanWord).filter(Boolean);
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
  if (!nlp || !text) return [];

  const doc = nlp(text);
  const terms = [];

  for (const raw of doc.match('#Noun').out('array')) {
    const [word] = trimEdges(splitClean(raw));
    if (word) terms.push({ key: lemmaOf(word), display: word, count: 1 });
  }

  for (const { normal, count } of doc.match('#Noun #Noun').out('freq')) {
    const words = trimEdges(splitClean(normal));
    // A bigram of two identical words ("running running") carries no topic
    // information the unigram does not already have, so it is dropped.
    if (words.length < 2 || words[0] === words[1]) continue;
    const display = words.join(' ');
    terms.push({ key: words.map(lemmaOf).join(' '), display, count });
  }

  return terms;
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
  let lemma = lemmaCache.get(word);
  if (lemma === undefined) {
    lemma = nlp(word).normalize({ plurals: true, verbs: true }).text().trim().toLowerCase();
    lemmaCache.set(word, lemma);
  }
  return lemma || word;
}
