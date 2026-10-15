// `Intl.Segmenter` becomes the universal splitter for EVERY language,
// not just CJK: English gets ICU word boundaries (contractions whole,
// possessives intact) instead of the legacy INVALID_CHARS mangling
// ("don't" → invented 'don'). Grouping — lemmaOf / simpleStem — sits on
// top and is unchanged. Tests needing a pristine engine state reset the
// module registry; the engine is never loaded here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  segmentWords,
  segmentationAvailable,
  zhSegmentationAvailable,
  segmentCjkWords,
} from '../src/analytics/segmentZh.js';
import { tokenizeText } from '../src/analytics/tokenize.js';

beforeEach(() => {
  vi.resetModules();
});

describe('segmentationAvailable', () => {
  it('reports Intl.Segmenter availability for each supported locale', () => {
    const present = typeof Intl.Segmenter === 'function';
    expect(segmentationAvailable('en')).toBe(present);
    expect(segmentationAvailable('zh')).toBe(present);
    expect(segmentationAvailable('ja')).toBe(present);
    expect(zhSegmentationAvailable()).toBe(present);
  });
});

describe('segmentWords — English', () => {
  it('keeps contractions whole where the legacy tokenizer split them', () => {
    expect(segmentWords("Don't stop", 'en')).toEqual(["don't", 'stop']);
    // Legacy reality: the apostrophe becomes a word boundary.
    expect(tokenizeText("don't stop")).toEqual(['don', 'stop']);
    expect(segmentWords("don't stop", 'en')).not.toContain('don');
  });

  it('splits hyphenated compounds into their words', () => {
    expect(segmentWords('state-of-the-art', 'en')).toEqual(
      expect.arrayContaining(['state', 'art']),
    );
    expect(segmentWords('state-of-the-art', 'en')).not.toContain('state-of-the-art');
  });

  it('is policy-free: stopwords, length, and digit filters belong to the caller', () => {
    expect(segmentWords('the art of running', 'en')).toEqual(['the', 'art', 'of', 'running']);
  });

  it('lowercases segments so the same word merges across languages', () => {
    expect(segmentWords('AI with Google', 'en')).toEqual(['ai', 'with', 'google']);
  });

  it('returns [] for empty or nullish input', () => {
    expect(segmentWords('', 'en')).toEqual([]);
    expect(segmentWords(null, 'en')).toEqual([]);
  });
});

describe('segmentWords — CJK locales', () => {
  it('segments Chinese identically to the CJK wrapper (policy lives in the wrapper)', () => {
    expect(segmentWords('如何學好英文寫作', 'zh')).toEqual(['如何', '學好', '英文', '寫作']);
    // Policy-free means the single-char stopword '的' survives here…
    expect(segmentWords('的應用研究', 'zh')).toContain('的');
    // …while segmentCjkWords drops it — the existing contract, unchanged.
    expect(segmentCjkWords('的應用研究')).not.toContain('的');
  });

  it('accepts the Japanese locale with a loose pin (ICU versions vary)', () => {
    const words = segmentWords('日本語のテキスト', 'ja');
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) {
      expect(w).toMatch(/^\S+$/);
    }
  });
});

describe('word cloud English plain path (engine never loaded)', () => {
  const EN_DOC = { id: '1', title: "Don't stop state-of-the-art", article_preview: '' };

  it("drops a whole contraction as a stopword instead of inventing a 'don' row", async () => {
    // With the splitter present this is the observable behaviour change:
    // ICU keeps the contraction whole, the stopword policy drops it —
    // where the legacy tokenizer split it and kept a phantom 'don'.
    const { wordCloudFrequencies } = await import('../src/analytics/wordcloud.js');
    const keywords = await import('../src/analytics/keywords.js');
    expect(keywords.keywordsReady()).toBe(false); // no chunk requested
    const map = new Map(wordCloudFrequencies([EN_DOC]));
    expect(map.get('don')).toBeUndefined();
    expect(map.get('stop')).toBe(1);
    expect(map.get('state')).toBe(1);
    expect(map.get('art')).toBe(1);
  });

  describe('without Intl.Segmenter', () => {
    const original = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');

    afterEach(() => {
      if (original) Object.defineProperty(Intl, 'Segmenter', original);
      else delete Intl.Segmenter;
      vi.resetModules();
    });

    it('falls back to the legacy tokenizer with byte-identical terms', async () => {
      // Regression guard, not fail-first: pre-change this IS the behaviour.
      // The stub must be in place before the modules load (memoized segmenters).
      Object.defineProperty(Intl, 'Segmenter', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const { segmentationAvailable: available } = await import('../src/analytics/segmentZh.js');
      const { wordCloudFrequencies } = await import('../src/analytics/wordcloud.js');
      expect(available('en')).toBe(false);

      const map = new Map(wordCloudFrequencies([EN_DOC]));
      // Legacy output: apostrophe stripped → phantom 'don' kept, hyphens gone.
      expect(map.get('don')).toBe(1);
      expect(map.get('stop')).toBe(1);
      expect(map.get('state')).toBe(1);
      expect(map.get('art')).toBe(1);
    });
  });
});
