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
 *   surface form.
 * - CJK documents keep the legacy bigram path (`tokenize.js`), unchanged.
 *
 * The returned list carries `[[display, count], …]` — never a raw lemma — so
 * the click-to-search round-trip in the view always issues a verbatim
 * substring query.
 */

import { bookmarkText, tokenizeFrequency } from './tokenize.js';
import { extractKeywordTerms, keywordsReady, documentLanguage } from './keywords.js';

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
 * @type {WeakMap<object, { path: 'engine'|'legacy', terms: object[] }>}
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
 * Terms for one bookmark, memoized per record and per extraction path.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 * @returns {object[]} engine path: `{ key, display, count }[]`;
 *   legacy path: `[term, count][]` entries.
 */
function termsFor(b) {
  const path = activePath();
  const cached = termsMemo.get(b);
  if (cached && cached.path === path) return cached.terms;

  let terms;
  if (path === 'engine' && documentLanguage(b) === 'en') {
    terms = extractKeywordTerms(bookmarkText(b));
  } else {
    // CJK path (and English documents when the engine is not loaded) —
    // surface forms only, grouped by the token itself.
    terms = [...tokenizeFrequency(bookmarkText(b))];
  }
  termsMemo.set(b, { path, terms });
  return terms;
}

/**
 * Aggregate one document's terms into the running maps.
 *
 * @param {{ lemmas: Map<string, {count: number,
 *   surfaces: Map<string, number>}>, plain: Map<string, number> }} acc
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 */
function accumulate(acc, b) {
  if (activePath() === 'engine' && documentLanguage(b) === 'en') {
    for (const { key, display, count } of termsFor(b)) {
      let group = acc.lemmas.get(key);
      if (!group) {
        group = { count: 0, surfaces: new Map() };
        acc.lemmas.set(key, group);
      }
      group.count += count;
      group.surfaces.set(display, (group.surfaces.get(display) || 0) + count);
    }
  } else {
    for (const [t, n] of termsFor(b)) {
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
  return `${activePath()}|${list.map(serialOf).join(',')}`;
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

  const entries = [
    ...[...acc.lemmas].map(([, group]) => [displayFor(group.surfaces), group.count]),
    ...[...acc.plain],
  ].sort((a, b) => b[1] - a[1]);

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
