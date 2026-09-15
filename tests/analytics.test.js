import { describe, it, expect } from 'vitest';
import { simpleStem, tokenizeText, tokenizeFrequency } from '../src/analytics/tokenize.js';
import { ENGLISH_STOPWORDS, CJK_STOPWORDS } from '../src/analytics/stopwords.js';
import { cosineSimilarity, mostSimilar, bookmarkTokenFreq } from '../src/analytics/similarity.js';
import { wordCloudFrequencies, wordCloudItems } from '../src/analytics/wordcloud.js';
import { topDomains } from '../src/analytics/domains.js';

// Regression guards: the stopword lists must not drift, or word-cloud and
// similarity output changes silently.
describe('stopwords', () => {
  it('has the exact monolith sizes', () => {
    expect(ENGLISH_STOPWORDS.size).toBe(200);
    expect(CJK_STOPWORDS.size).toBe(32);
  });
  it('contains golden entries', () => {
    expect(ENGLISH_STOPWORDS.has('the')).toBe(true);
    expect(ENGLISH_STOPWORDS.has('https')).toBe(true);
    expect(CJK_STOPWORDS.has('的')).toBe(true);
  });
});

describe('simpleStem', () => {
  it('stems common suffixes', () => {
    expect(simpleStem('running')).toBe('runn');
    expect(simpleStem('studies')).toBe('study');
    expect(simpleStem('cares')).toBe('car');
    expect(simpleStem('cats')).toBe('cat');
    expect(simpleStem('jumped')).toBe('jump');
  });
  it('respects the length thresholds', () => {
    expect(simpleStem('ing')).toBe('ing'); // < 4
    expect(simpleStem('sing')).toBe('sing'); // ing but len 4 (not > 5)
    expect(simpleStem('ties')).toBe('tie'); // ies/es guards need len > 4, so the 's' rule applies
    expect(simpleStem('miss')).toBe('miss'); // ends with ss
  });
});

describe('tokenizeText', () => {
  it('returns [] for falsy input', () => {
    expect(tokenizeText('')).toEqual([]);
    expect(tokenizeText(null)).toEqual([]);
  });
  it('drops stopwords, pure digits and short tokens', () => {
    expect(tokenizeText('the quick brown fox 123 a of it')).toEqual(['quick', 'brown', 'fox']);
  });
  it('stems English tokens', () => {
    expect(tokenizeText('running studies')).toEqual(['runn', 'study']);
  });
  it('emits CJK bigrams and drops CJK stopwords', () => {
    // "在" is a stopword but appears in bigrams; 的/了 combos are dropped.
    const tokens = tokenizeText('說明一下');
    expect(tokens).toContain('說明');
    expect(tokens).toContain('明一');
  });
  it('replaces punctuation with separators', () => {
    expect(tokenizeText('hello,world!')).toEqual(['hello', 'world']);
  });
});

describe('tokenizeFrequency', () => {
  it('counts tokens', () => {
    const freq = tokenizeFrequency('fox fox cat');
    expect(freq.get('fox')).toBe(2);
    expect(freq.get('cat')).toBe(1);
  });
});

describe('cosineSimilarity', () => {
  const mk = (title, preview) => ({ id: 'x', title, article_preview: preview });

  it('returns 1 for identical texts', () => {
    const a = mk('Hello World', 'foo bar');
    expect(cosineSimilarity(a, mk('Hello World', 'foo bar'))).toBeCloseTo(1);
  });
  it('returns 0 for disjoint texts', () => {
    expect(cosineSimilarity(mk('alpha', 'beta'), mk('gamma', 'delta'))).toBe(0);
  });
  it('returns 0 when either side is empty', () => {
    expect(cosineSimilarity(mk('', ''), mk('alpha', 'beta'))).toBe(0);
  });
});

describe('mostSimilar', () => {
  const list = [
    { id: 'a', title: 'apple pie', article_preview: '' },
    { id: 'b', title: 'apple tart', article_preview: '' },
    { id: 'c', title: 'zebra', article_preview: '' },
    { id: 'd', title: 'apple pie', article_preview: '' },
  ];

  it('excludes the target and ranks by score desc', () => {
    const res = mostSimilar(list, list[0], 5);
    expect(res.map((r) => r.doc.id)).not.toContain('a');
    expect(res[0].doc.id).toBe('d');
    expect(res[0].score).toBeCloseTo(1);
  });
  it('caps results at top N', () => {
    const res = mostSimilar(list, list[0], 2);
    expect(res.length).toBeLessThanOrEqual(2);
  });
  it('bookmarkTokenFreq uses title + preview', () => {
    const freq = bookmarkTokenFreq({ id: 'x', title: 'fox', article_preview: 'fox fox' });
    expect(freq.get('fox')).toBe(3);
  });
});

describe('wordcloud', () => {
  it('aggregates and sorts desc, capped at 60', () => {
    const bms = Array.from({ length: 70 }, (_, i) => ({
      id: String(i),
      title: `word${i} common`,
      article_preview: 'common',
    }));
    const freq = wordCloudFrequencies(bms);
    expect(freq.length).toBeLessThanOrEqual(60);
    expect(freq[0][0]).toBe('common');
    for (let i = 1; i < freq.length; i++) {
      expect(freq[i - 1][1]).toBeGreaterThanOrEqual(freq[i][1]);
    }
  });
  it('returns [] for empty input', () => {
    expect(wordCloudFrequencies([{ id: 'x', title: '  the ', article_preview: '' }])).toEqual([]);
  });
  it('computes sizeRatio 0.75..2.25', () => {
    const items = wordCloudItems([
      ['hi', 10],
      ['lo', 0],
    ]);
    expect(items[0].sizeRatio).toBeCloseTo(2.25);
    expect(items[1].sizeRatio).toBeCloseTo(0.75);
  });
});

describe('topDomains', () => {
  it('strips www. and counts, sorted desc, capped', () => {
    const bms = [
      { id: '1', url: 'https://www.example.com/a' },
      { id: '2', url: 'https://example.com/b' },
      { id: '3', url: 'https://other.org/c' },
    ];
    expect(topDomains(bms)).toEqual([
      ['example.com', 2],
      ['other.org', 1],
    ]);
    expect(topDomains(bms, 1)).toEqual([['example.com', 2]]);
  });
  it('skips invalid URLs', () => {
    expect(
      topDomains([
        { id: '1', url: '::::' },
        { id: '2', url: 'https://ok.com/' },
      ]),
    ).toEqual([['ok.com', 1]]);
  });
});
