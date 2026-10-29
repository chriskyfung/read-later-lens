import { describe, it, expect } from 'vitest';
import { segmentCjkWords, zhSegmentationAvailable } from '../src/analytics/core/segmentZh.js';

describe('zhSegmentationAvailable', () => {
  it('reports Intl.Segmenter availability (present on every evergreen runtime)', () => {
    expect(zhSegmentationAvailable()).toBe(typeof Intl.Segmenter === 'function');
  });
});

describe('segmentCjkWords', () => {
  it('segments a Traditional Chinese sentence into words, not bigrams', () => {
    // The legacy bigram path produced overlapping fragments like '度學'
    // next to the real words; the segmenter emits dictionary words only.
    expect(segmentCjkWords('如何學好英文寫作')).toEqual(['如何', '學好', '英文', '寫作']);
    const words = segmentCjkWords('機器學習與深度學習的比較');
    // ICU cuts compounds at dictionary-word boundaries (深度 + 學習).
    expect(words).toEqual(expect.arrayContaining(['機器', '學習', '深度']));
    expect(words).not.toContain('度學');
  });

  it('drops single-character function words and CJK stopwords', () => {
    const words = segmentCjkWords('AI與Google的人工智慧應用');
    expect(words).not.toContain('的'); // single-char stopword
    expect(words).toContain('人工');
    expect(words).toContain('智慧');
    expect(words).not.toContain('工智'); // no overlapping bigram fragments
  });

  it('returns Latin runs lowercased so they can join the lemma namespace', () => {
    expect(segmentCjkWords('AI與Google的人工智慧應用')).toEqual(
      expect.arrayContaining(['ai', 'google']),
    );
  });

  it('returns [] for empty or nullish input', () => {
    expect(segmentCjkWords('')).toEqual([]);
    expect(segmentCjkWords(null)).toEqual([]);
  });

  it('passes Latin-only text through as lowercased words (caller filters)', () => {
    // The segmenter's contract is segmentation, not noise policy: English
    // text comes back as its words so `extractCjkKeywordTerms` can apply
    // the shared stopword/length/digit filters.
    expect(segmentCjkWords('Plain English text')).toEqual(['plain', 'english', 'text']);
  });

  it('accepts a locale argument and returns words for Japanese text', () => {
    // Loose pin only: ICU dictionary output varies across versions, so the
    // contract asserted here is "words, no whitespace/punctuation" — not the
    // exact segmentation.
    const words = segmentCjkWords('日本語のテキストを解析する', 'ja');
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) {
      expect(w).toMatch(/^\S+$/);
    }
  });
});
