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
 *   surface form — once the engine is loaded; until then (or after a load
 *   failure) they use the legacy stem path.
 * - CJK documents segment into words via `Intl.Segmenter`
 *   (`segmentZh.js`) whenever the API exists — NO engine chunk required,
 *   so a Chinese-only library renders segmented words with zero downloads.
 *   Latin runs inside them group with the engine's lemma (the legacy
 *   stemmer until the chunk arrives). A failed chunk load degrades every
 *   language to the legacy bigram/stem path together; a runtime without
 *   Intl.Segmenter only affects CJK documents.
 *
 * Whatever path produced a term, the final aggregation merges both
 * namespaces on the display form, so each word renders exactly once.
 *
 * The returned list carries `[[display, count], …]` — never a raw lemma — so
 * the click-to-search round-trip in the view always issues a verbatim
 * substring query.
 */

import { bookmarkText, tokenizeFrequency } from './tokenize.js';
import {
  extractKeywordTerms,
  extractCjkKeywordTerms,
  keywordsReady,
  keywordsFailed,
  documentLanguage,
} from './keywords.js';
import { zhSegmentationAvailable } from './segmentZh.js';

/**
 * Per-record memo of the extracted terms, keyed on the bookmark object itself.
 *
 * The word cloud recomputes on every `renderAll` (tab switch, filter change,
 * debounced keystroke), and the extraction — a full compromise POS parse per
 * English document — is the dominant cost (~0.6–0.8 ms/doc measured). Memoizing
 * per record turns repeated renders into lookups.
 *
 * A WeakMap (not a text-keyed Map) because it cannot outlive its key: a
 * re-import replaces the record objects wholesale, so stale entries are
 * collected instead of pinned in memory with their full preview text. This is
 * safe only because no code mutates `title`/`article_preview` in place — every
 * mutation path (import, trash, restore) builds new record objects.
 *
 * Entries record which path produced them (`engine` vs `legacy`), because the
 * two disagree: an entry computed through the legacy tokenizer while the
 * engine was unloaded must not be served after the engine arrives (the
 * `failed → ready` transition is the real case), and vice versa.
 *
 * @type {WeakMap<object, { path: 'engine'|'legacy',
 *   mode: 'grouped'|'plain', terms: object[] }>}
 */
const termsMemo = new WeakMap();

/**
 * Stable, unique-per-record token, assigned once per bookmark object.
 *
 * The aggregate memo is keyed on the filtered list, but an id sequence is not
 * a content fingerprint: a re-import replaces the record objects, so the same
 * ids can carry different text (a re-imported, edited CSV is the realistic
 * case). Serializing the record *objects* rather than their ids makes the key
 * self-invalidating — a new record object is a new serial, so a stale
 * aggregate can never be served.
 *
 * @type {WeakMap<object, number>}
 */
const recordSerial = new WeakMap();

/** @type {number} */
let nextSerial = 1;

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 * @returns {number} the record's serial, assigned on first sight
 */
function serialOf(b) {
  let serial = recordSerial.get(b);
  if (serial === undefined) {
    serial = nextSerial;
    nextSerial += 1;
    recordSerial.set(b, serial);
  }
  return serial;
}

/** @returns {'engine'|'legacy'} The path that must produce terms right now. */
function activePath() {
  return keywordsReady() ? 'engine' : 'legacy';
}

/**
 * The two GLOBAL extraction gates, evaluated together and threaded through
 * the per-document branching below so they never hide inside it:
 *
 * - `path` — the engine chunk state (`activePath()`).
 * - `segmenting` — `Intl.Segmenter` exists AND the engine has not failed.
 *   A chunk failure degrades every language to the legacy path together,
 *   because an English document on the plain path shows stem displays
 *   ('runn') while a CJK document on the grouped path would show surface
 *   displays ('running') — splitting one word into two rows again.
 *   Segmentation itself needs NO engine chunk: a Chinese-only library
 *   segments while the compromise download stays at zero.
 *
 * Both operands are cheap (memoized segmenter, O(1) engine state), so
 * evaluating this once per record and once per aggregate is fine.
 *
 * @returns {{ path: 'engine'|'legacy', segmenting: boolean }}
 */
function gating() {
  return { path: activePath(), segmenting: zhSegmentationAvailable() && !keywordsFailed() };
}

/**
 * Grouping mode for one document.
 *
 * - English documents group only when the engine is loaded.
 * - CJK documents group while `gate.segmenting` holds (see `gating()`).
 *
 * @param {string} lang `documentLanguage(b)`
 * @param {{ path: 'engine'|'legacy', segmenting: boolean }} gate `gating()`
 * @returns {'grouped'|'plain'}
 */
function modeFor(lang, gate) {
  if (lang === 'en') return gate.path === 'engine' ? 'grouped' : 'plain';
  return gate.segmenting ? 'grouped' : 'plain';
}

/**
 * Terms for one bookmark, memoized per record, extraction path, AND
 * grouping mode — the mode can flip without a path change (a chunk failure
 * moves CJK documents from 'grouped' to 'plain' while both states are
 * 'legacy'), so the cache must compare it explicitly.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 * @returns {{ mode: 'grouped'|'plain', terms: object[] }} `grouped`:
 *   `{ key, display, count }[]` (English via compromise once loaded, CJK
 *   via Intl.Segmenter); `plain`: `[term, count][]` surface entries
 *   (English before the engine arrives or after a failure, CJK without
 *   Intl.Segmenter or after a failure).
 */
function termsFor(b) {
  const gate = gating();
  const lang = documentLanguage(b);
  const mode = modeFor(lang, gate);
  const cached = termsMemo.get(b);
  if (cached && cached.path === gate.path && cached.mode === mode) return cached;

  let terms;
  if (mode === 'grouped') {
    // English documents go through compromise; CJK documents segment into
    // words with Latin runs lemma-grouped (stem-keyed until the engine
    // arrives), so one word never renders twice.
    terms =
      lang === 'en'
        ? extractKeywordTerms(bookmarkText(b))
        : extractCjkKeywordTerms(bookmarkText(b), lang);
  } else {
    // Legacy path: surface forms only, grouped by the token itself.
    terms = [...tokenizeFrequency(bookmarkText(b))];
  }
  const entry = { path: gate.path, mode, terms };
  termsMemo.set(b, entry);
  return entry;
}

/**
 * Aggregate one document's terms into the running maps.
 *
 * @param {{ lemmas: Map<string, {count: number,
 *   surfaces: Map<string, number>}>, plain: Map<string, number> }} acc
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 */
function accumulate(acc, b) {
  const { mode, terms } = termsFor(b);
  if (mode === 'grouped') {
    for (const { key, display, count } of terms) {
      let group = acc.lemmas.get(key);
      if (!group) {
        group = { count: 0, surfaces: new Map() };
        acc.lemmas.set(key, group);
      }
      group.count += count;
      group.surfaces.set(display, (group.surfaces.get(display) || 0) + count);
    }
  } else {
    for (const [t, n] of terms) {
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
 * Memo of the aggregated result, keyed on the filtered list's record serials.
 *
 * The aggregation itself is cheap next to extraction, but it runs on every
 * `renderAll` even when nothing that feeds it changed (tab away and back,
 * selection-only updates). The key carries the active path too, so an engine
 * arriving never serves a legacy aggregate.
 *
 * @type {{ key: string, entries: Array<[string, number]> } | null}
 */
let aggregateMemo = null;

/** @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} list */
function aggregateKey(list) {
  const gate = gating();
  // Each record's serial carries its grouping mode too: a chunk failure
  // flips CJK documents from 'grouped' to 'plain' WITHOUT changing
  // gate.path (both are 'legacy'), and a mode-blind key would serve the
  // pre-failure aggregate with the stale terms.
  return `${gate.path}|${list.map((b) => `${serialOf(b)}:${modeFor(documentLanguage(b), gate)}`).join(',')}`;
}

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} list
 * @returns {Array<[string, number]>} sorted desc by count, capped at 60.
 *   The term is the display form (a verbatim substring of the source text).
 */
export function wordCloudFrequencies(list) {
  const key = aggregateKey(list);
  if (aggregateMemo && aggregateMemo.key === key) return aggregateMemo.entries.slice();

  const acc = { lemmas: new Map(), plain: new Map() };

  for (const b of list) {
    accumulate(acc, b);
  }

  // One row per display form, across BOTH namespaces. An English document
  // contributes lemma groups while a CJK document contributes plain tokens,
  // so a Latin word that occurs in both ('ai', 'google') would otherwise
  // render twice with its count split between the two rows (#51 regression).
  // Merging on the (lowercased) display keeps the click-to-search contract:
  // the surviving label is still a verbatim substring of some source text.
  const merged = new Map();
  for (const [display, count] of [
    ...[...acc.lemmas].map(([, group]) => [displayFor(group.surfaces), group.count]),
    ...acc.plain,
  ]) {
    const word = display.toLowerCase();
    merged.set(word, (merged.get(word) || 0) + count);
  }

  const entries = [...merged].sort((a, b) => b[1] - a[1]);

  aggregateMemo = { key, entries: entries.slice(0, 60) };
  return aggregateMemo.entries.slice();
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
