/**
 * @fileoverview Tests for worker-scoped keyword term extraction.
 *
 * Colocated beside src/analytics/worker/extract.js. Tests the pure
 * extraction functions that don't require the `compromise` engine, plus
 * the engine-state helpers. `extractKeywordTerms` is tested only for the
 * no-engine case (returns []); engine-backed extraction is covered by
 * `src/analytics/extract.test.js` on the main thread.
 */

import { describe, it, expect } from 'vitest';
import {
  extractPlainTerms,
  extractPlainEnglishTerms,
  extractCjkKeywordTerms,
  extractKeywordTerms,
  workerEngineState,
} from './extract.js';

describe('extractPlainTerms', () => {
  it('returns [] for empty text', () => {
    expect(extractPlainTerms('')).toEqual([]);
    expect(extractPlainTerms(null)).toEqual([]);
  });

  it('extracts English plain terms with stemming', () => {
    const terms = extractPlainTerms('running runs run', 'en');
    const words = new Set(terms.map(([t]) => t));
    // All three forms stem to 'run'.
    expect(words.has('run')).toBe(true);
  });

  it('applies the caller-provided stopset', () => {
    const withStop = extractPlainTerms('the apple and the banana', 'en', new Set());
    const withoutStop = extractPlainTerms('the apple and the banana', 'en');
    // With empty stopset, 'the' and 'and' appear; with BASE_EN they don't.
    expect(withStop.some(([t]) => t === 'the')).toBe(true);
    expect(withoutStop.some(([t]) => t === 'the')).toBe(false);
  });

  it('extracts CJK plain terms', () => {
    const terms = extractPlainTerms('人工智能 機器學習', 'zh');
    expect(terms.length).toBeGreaterThan(0);
  });
});

describe('extractPlainEnglishTerms', () => {
  it('filters cloud aesthetic stopwords', () => {
    const terms = extractPlainEnglishTerms('the time is now, make it new');
    const words = new Set(terms.map(([t]) => t));
    // 'time', 'new', 'make' are all in CLOUD_EN_AESTHETIC and should be dropped.
    expect(words.has('time')).toBe(false);
    expect(words.has('new')).toBe(false);
    expect(words.has('make')).toBe(false);
    // 'now', 'it' should appear.
    expect(words.has('now')).toBe(true);
  });
});

describe('extractCjkKeywordTerms', () => {
  it('returns [] for empty text', () => {
    expect(extractCjkKeywordTerms('')).toEqual([]);
  });

  it('extracts CJK terms with surfaces as keys', () => {
    const terms = extractCjkKeywordTerms('人工智能', 'zh');
    expect(terms.length).toBeGreaterThan(0);
    for (const { key, display, count } of terms) {
      expect(key).toBe(display);
      expect(count).toBe(1);
    }
  });

  it('routes Latin runs through the legacy stemmer when no engine', () => {
    // Worker starts in 'idle' state — no compromise engine loaded.
    // Latin runs inside CJK text fall back to simpleStem.
    const terms = extractCjkKeywordTerms('AI 人工智能', 'zh');
    const aiTerm = terms.find((t) => t.key === 'ai' || t.display === 'ai');
    expect(aiTerm).toBeDefined();
  });
});

describe('extractKeywordTerms', () => {
  it('returns [] when the worker engine is not loaded', () => {
    // Worker starts idle; no compromise engine available.
    expect(extractKeywordTerms('apple pie recipe')).toEqual([]);
  });
});

describe('workerEngineState', () => {
  it('reports idle state initially', () => {
    const { state, nlp } = workerEngineState();
    expect(state).toBe('idle');
    expect(nlp).toBeNull();
  });
});
