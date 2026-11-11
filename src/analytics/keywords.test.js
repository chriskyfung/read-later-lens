import { describe, it, expect, beforeAll, vi } from 'vitest';
import {
  extractKeywordTerms,
  loadKeywordsEngine,
  keywordsReady,
  needsKeywordEngine,
  documentLanguage,
} from './keywords.js';
import * as keywordsModule from './keywords.js';
import { wordCloudFrequencies } from './wordcloud.js';

// The engine is lazy: every test in this file needs it loaded first, which is
// exactly the contract the word-cloud view relies on. The un-loaded fallback
// path (legacy tokenizer) is pinned in tests/analytics.test.js, which runs in
// its own module registry and never loads the engine.
beforeAll(async () => {
  await loadKeywordsEngine();
});

describe('loadKeywordsEngine', () => {
  it('loads once and reports ready', () => {
    expect(keywordsReady()).toBe(true);
  });

  it('resolves the same engine on repeated calls', async () => {
    const a = await loadKeywordsEngine();
    const b = await loadKeywordsEngine();
    expect(a).toBe(b);
  });

  it('reports the engine as needed only while it is not loaded', () => {
    // Already loaded here — pins the "settled states never re-request" branch;
    // the unloaded branch is covered by tests/views-wordcloud.test.js.
    expect(needsKeywordEngine([{ id: '1', title: 'apple', article_preview: '' }])).toBe(false);
  });
});

describe('extractKeywordTerms', () => {
  it('groups inflections under one lemma key while keeping surface forms', () => {
    const terms = extractKeywordTerms('running running running runs');
    // Four unigram occurrences, all keyed on the lemma 'run'.
    const unigrams = terms.filter((t) => !t.display.includes(' '));
    expect(unigrams).toHaveLength(4);
    expect(unigrams.every((t) => t.key === 'run')).toBe(true);
    // Display forms are the verbatim surface words — never the lemma.
    expect(unigrams.map((t) => t.display).sort()).toEqual([
      'running',
      'running',
      'running',
      'runs',
    ]);
  });

  it('lemmatizes the classic stemmer casualties', () => {
    // The old hand-rolled stemmer produced 'runn' and 'car'; the key is the
    // real lemma and the display stays readable. (A bare single word is not
    // POS-tagged as a noun by compromise, so these use sentence context.)
    expect(extractKeywordTerms('the daily cares')[0].key).toBe('care');
    expect(extractKeywordTerms('empty boxes')[0].key).toBe('box');
    expect(extractKeywordTerms('breaking news')[0].key).toBe('news'); // not over-stemmed to 'new'
  });

  it('keeps ungrouped what compromise cannot lemmatize (documented limitation)', () => {
    // Rule-based normalization misses some irregular plurals ('knives',
    // 'runners'); they then group by surface form instead of by lemma. The
    // display stays a real word either way, which is what the cloud needs.
    const keyOf = (text, display) =>
      extractKeywordTerms(text).find((t) => t.display === display).key;
    expect(keyOf('the runners', 'runners')).toBe('runners');
    expect(keyOf('steel knives', 'knives')).toBe('knives');
  });

  it('emits noun-phrase bigrams as single terms with their own count', () => {
    const terms = extractKeywordTerms('machine learning machine learning');
    const phrase = terms.find((t) => t.display === 'machine learning');
    expect(phrase).toEqual({ key: 'machine learn', display: 'machine learning', count: 2 });
  });
});

describe('wordCloudFrequencies memo', () => {
  const docs = [
    { id: '1', title: 'Machine Learning Tutorials', article_preview: '' },
    { id: '2', title: 'Climate Change Reports', article_preview: '' },
  ];

  it('memoizes per-record terms across identical records', () => {
    const first = wordCloudFrequencies(docs);
    const spy = vi.spyOn(keywordsModule, 'extractKeywordTerms');
    try {
      const second = wordCloudFrequencies(docs);
      // Identical output, and the expensive extraction never ran.
      expect(second).toEqual(first);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('reuses per-record terms but re-aggregates a different filtered set', () => {
    const both = wordCloudFrequencies(docs);

    // Narrowing the filter reuses each record's memoized terms (no
    // re-extraction) but must still re-aggregate over the new subset — the
    // per-record memo is what makes this cheap, not skipped work.
    const spy = vi.spyOn(keywordsModule, 'extractKeywordTerms');
    try {
      const narrowed = wordCloudFrequencies([docs[1]]);
      expect(spy).not.toHaveBeenCalled();
      expect(narrowed).not.toEqual(both);
      expect(new Map(narrowed).get('climate')).toBe(1);
      expect(new Map(narrowed).get('machine')).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('returns an independent array each call (memo is not shared state)', () => {
    const docs = [{ id: '1', title: 'Machine Learning', article_preview: '' }];
    const a = wordCloudFrequencies(docs);
    const b = wordCloudFrequencies(docs);
    expect(a).not.toBe(b); // a caller mutating the result must not corrupt the cache
    expect(a).toEqual(b);
  });

  it('returns equal results for fresh record objects with equal text', () => {
    // The memo is keyed on record identity, so a re-import (new objects, same
    // text) recomputes — but must produce the same answer.
    const before = wordCloudFrequencies([
      { id: '1', title: 'Machine Learning Tutorials', article_preview: '' },
    ]);
    const after = wordCloudFrequencies([
      { id: '1', title: 'Machine Learning Tutorials', article_preview: '' },
    ]);
    expect(after).toEqual(before);
  });

  it('never serves stale terms when the same id carries different text', () => {
    // The aggregate key fingerprints the record objects, not their ids: a
    // re-imported (edited) library reuses ids with new text, and an id-only
    // key would serve the previous cloud. This is the collision that keying
    // on `list.map(b => b.id)` caused.
    const first = wordCloudFrequencies([
      { id: '1', title: 'Machine Learning', article_preview: '' },
    ]);
    expect(new Map(first).get('machine learning')).toBe(1);

    // Same id, completely different document.
    const second = wordCloudFrequencies([
      { id: '1', title: 'Climate Change Reports', article_preview: '' },
    ]);
    const map = new Map(second);
    expect(map.get('machine learning')).toBeUndefined();
    expect(map.get('climate')).toBe(1);
  });
});

describe('documentLanguage — memo', () => {
  it('returns a stable answer for the same record', () => {
    const doc = { id: '1', title: 'Machine Learning', article_preview: '' };
    expect(documentLanguage(doc)).toBe('en');
    expect(documentLanguage(doc)).toBe('en');
  });

  it('classifies CJK records', () => {
    expect(documentLanguage({ id: '1', title: '如何學好英文寫作', article_preview: '' })).toBe(
      'zh',
    );
  });
});
