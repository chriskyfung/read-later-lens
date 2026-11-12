// Characterization pins for the DECLARED LEGACY FALLBACK (`tokenize.js`).
// `simpleStem` is load-bearing beyond the legacy splitter — it is the
// pre-engine grouping key (`latinKeyFor`) and the plain-path key = display
// contract (`extractPlainEnglishTerms`) — so these pins exist to make a
// future "delete the legacy tokenizer" cleanup fail loudly instead of
// silently changing grouping. Fail-first: N/A by design — the pins pass
// before and after the docs-only change they accompany; they guard the
// FUTURE deletion, not this commit.
import { describe, it, expect } from 'vitest';
import { simpleStem, tokenizeText, tokenizeFrequency, bookmarkText } from './tokenize.js';

describe('simpleStem (legacy stemmer, load-bearing)', () => {
  it('stems the suffix rules in order, exactly as the original monolith', () => {
    expect(simpleStem('running')).toBe('runn'); // -ing (len > 5)
    expect(simpleStem('stories')).toBe('story'); // -ies → -y
    expect(simpleStem('boxes')).toBe('box'); // -es (len > 4)
    expect(simpleStem('shoes')).toBe('sho'); // -es quirk: strips 'es', not 'e'
    expect(simpleStem('walked')).toBe('walk'); // -ed (len > 4)
    expect(simpleStem('cats')).toBe('cat'); // -s (len > 3)
  });

  it('passes words through untouched when no rule applies', () => {
    expect(simpleStem('cat')).toBe('cat'); // shorter than 4 → no rules
    expect(simpleStem('run')).toBe('run'); // shorter than 4 → no rules
    expect(simpleStem('glass')).toBe('glass'); // -ss exception
    expect(simpleStem('search')).toBe('search'); // no matching suffix
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

describe('bookmarkText', () => {
  it('joins title and preview with a single space', () => {
    expect(bookmarkText({ id: 'x', title: 'a', article_preview: 'b' })).toBe('a b');
  });

  it('treats missing title / preview as empty strings', () => {
    expect(bookmarkText({ id: 'x', title: 'a' })).toBe('a ');
    expect(bookmarkText({ id: 'x', article_preview: 'b' })).toBe(' b');
    expect(bookmarkText({ id: 'x' })).toBe(' ');
    expect(bookmarkText({})).toBe(' ');
  });
});
