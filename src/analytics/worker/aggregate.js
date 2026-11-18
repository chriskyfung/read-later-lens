/**
 * @fileoverview Worker-scoped frequency aggregation for the word cloud.
 *
 * Mirrors the aggregation logic in `src/analytics/wordcloud.js` but operates
 * on serialized bookmark DTOs (plain objects) instead of live BookmarkRecord
 * instances. Stateless per call — no WeakMap, no cross-call memoization.
 *
 * Input:  Array<{ id, title, article_preview, detected_language, ... }>
 * Output: Array<[word, count]> sorted desc, capped at 60.
 */

import {
  extractKeywordTerms,
  extractPlainEnglishTerms,
  extractCjkKeywordTerms,
  workerEngineState,
} from './extract.js';
import { segmentationAvailable } from '../core/segmentZh.js';
import { simpleStem } from './constants.js';

/** @type {Map<string, { count: number, surfaces: Map<string, number> }>} */
let lemmas;
/** @type {Map<string, number>} */
let plain;

/**
 * Per-document gate for the worker. Mirrors `gating()` in wordcloud.js but
 * uses the worker's own engine state.
 *
 * @returns {{ path: 'engine'|'legacy', segmenting: boolean }}
 */
function workerGate() {
  const { state } = workerEngineState();
  const path = state === 'ready' ? 'engine' : 'legacy';
  const segmenting = segmentationAvailable('zh') && state !== 'failed';
  return { path, segmenting };
}

/**
 * Grouping mode for one document.
 *
 * - English documents group only when the engine is loaded.
 * - CJK documents group while `gate.segmenting` holds.
 *
 * @param {string} lang
 * @param {{ path: 'engine'|'legacy', segmenting: boolean }} gate
 * @returns {'grouped'|'plain'}
 */
function modeFor(lang, gate) {
  if (lang === 'en') return gate.path === 'engine' ? 'grouped' : 'plain';
  return gate.segmenting ? 'grouped' : 'plain';
}

/**
 * Text source for frequency analysis: bookmark title + plain-text preview.
 *
 * @param {{ title?: string, article_preview?: string }} b
 * @returns {string}
 */
function bookmarkText(b) {
  return (b.title || '') + ' ' + (b.article_preview || '');
}

/**
 * Terms for one bookmark DTO. No memoization — computed fresh each call.
 *
 * @param {{ id: string|number, title: string, article_preview: string, detected_language: string }} b
 * @param {{ path: 'engine'|'legacy', segmenting: boolean }} gate
 * @returns {{ mode: 'grouped'|'plain', terms: object[] }}
 */
function termsFor(b, gate) {
  const lang = b.detected_language;
  const mode = modeFor(lang, gate);

  let terms;
  if (mode === 'grouped') {
    terms =
      lang === 'en'
        ? extractKeywordTerms(bookmarkText(b))
        : extractCjkKeywordTerms(bookmarkText(b), lang);
  } else {
    terms =
      lang === 'en' && segmentationAvailable('en')
        ? extractPlainEnglishTerms(bookmarkText(b))
        : [...tokenizeFrequency(bookmarkText(b))];
  }
  return { mode, terms };
}

/**
 * Legacy tokenizer frequency (plain path fallback when no Intl.Segmenter).
 * Mirrors `tokenizeFrequency` in `src/analytics/core/tokenize.js`.
 *
 * @param {string} text
 * @returns {Map<string, number>}
 */
function tokenizeFrequency(text) {
  if (!text) return new Map();
  const freq = new Map();
  const cleaned = text.toLowerCase().replace(/[^\w\s\u4e00-\u9fa5\u3040-\u30ff]/g, ' ');
  const rawTokens = cleaned.split(/\s+/);
  for (const word of rawTokens) {
    if (!word || word.length < 2) continue;
    if (/^[a-z0-9]+$/.test(word)) {
      const stemmed = simpleStem(word);
      freq.set(stemmed, (freq.get(stemmed) || 0) + 1);
    } else if (/[\u4e00-\u9fa5\u3040-\u30ff]/.test(word)) {
      for (let i = 0; i < word.length - 1; i++) {
        freq.set(word.substring(i, i + 2), (freq.get(word.substring(i, i + 2)) || 0) + 1);
      }
    }
  }
  return freq;
}

/**
 * Aggregate one document's terms into the running maps.
 *
 * @param {{ mode: 'grouped'|'plain', terms: object[] }} entry
 */
function accumulate(entry) {
  if (entry.mode === 'grouped') {
    for (const { key, display, count } of entry.terms) {
      let group = lemmas.get(key);
      if (!group) {
        group = { count: 0, surfaces: new Map() };
        lemmas.set(key, group);
      }
      group.count += count;
      group.surfaces.set(display, (group.surfaces.get(display) || 0) + count);
    }
  } else {
    for (const [t, n] of entry.terms) {
      plain.set(t, (plain.get(t) || 0) + n);
    }
  }
}

/**
 * Most frequent surface form of a lemma group; ties break to first-seen.
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
 * Compute word-cloud frequencies for a list of serialized bookmark DTOs.
 *
 * @param {Array<{ id: string|number, title: string, article_preview: string, detected_language: string }>} list
 * @returns {Array<[string, number]>} sorted desc by count, capped at 60.
 */
export function computeWordCloudFrequencies(list) {
  lemmas = new Map();
  plain = new Map();

  const gate = workerGate();

  for (const b of list) {
    const entry = termsFor(b, gate);
    accumulate(entry);
  }

  // Merge lemma groups and plain terms on display form, same as main thread.
  const merged = new Map();
  for (const [display, count] of [
    ...[...lemmas].map(([, group]) => [displayFor(group.surfaces), group.count]),
    ...plain,
  ]) {
    const word = display.toLowerCase();
    merged.set(word, (merged.get(word) || 0) + count);
  }

  const entries = [...merged].sort((a, b) => b[1] - a[1]);
  return entries.slice(0, 60);
}

/**
 * Compute size ratios for display.
 *
 * @param {Array<[string, number]>} sorted
 * @returns {{ word: string, count: number, sizeRatio: number }[]}
 */
export function computeWordCloudItems(sorted) {
  if (sorted.length === 0) return [];
  const maxCount = sorted[0][1];
  return sorted.map(([word, count]) => ({
    word,
    count,
    sizeRatio: 0.75 + (count / maxCount) * 1.5,
  }));
}
