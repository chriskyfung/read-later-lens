import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from '../src/core/searchParser.js';

describe('parseSearchQuery', () => {
  it('returns an empty list for blank input', () => {
    expect(parseSearchQuery('')).toEqual([]);
    expect(parseSearchQuery('   ')).toEqual([]);
    expect(parseSearchQuery(null)).toEqual([]);
    expect(parseSearchQuery(undefined)).toEqual([]);
  });

  it('splits bare whitespace-separated terms as AND keywords', () => {
    expect(parseSearchQuery('term1 term2')).toEqual([
      { terms: 'term1', exact: false, urlOnly: false },
      { terms: 'term2', exact: false, urlOnly: false },
    ]);
  });

  it('treats a quoted phrase as one exact term', () => {
    expect(parseSearchQuery('"term1 term2"')).toEqual([
      { terms: 'term1 term2', exact: true, urlOnly: false },
    ]);
  });

  it('supports mixing bare terms and quoted phrases', () => {
    expect(parseSearchQuery('foo "bar baz" qux')).toEqual([
      { terms: 'foo', exact: false, urlOnly: false },
      { terms: 'bar baz', exact: true, urlOnly: false },
      { terms: 'qux', exact: false, urlOnly: false },
    ]);
  });

  it('supports multiple quoted phrases', () => {
    expect(parseSearchQuery('"a b" "c d"')).toEqual([
      { terms: 'a b', exact: true, urlOnly: false },
      { terms: 'c d', exact: true, urlOnly: false },
    ]);
  });

  it('lowercases all terms', () => {
    expect(parseSearchQuery('Alpha "Beta Gamma"')).toEqual([
      { terms: 'alpha', exact: false, urlOnly: false },
      { terms: 'beta gamma', exact: true, urlOnly: false },
    ]);
  });

  it('handles an unbalanced trailing quote gracefully (literal term)', () => {
    // '"foo bar' — the bare segment keeps the quote character.
    expect(parseSearchQuery('"foo bar')).toEqual([
      { terms: '"foo', exact: false, urlOnly: false },
      { terms: 'bar', exact: false, urlOnly: false },
    ]);
  });

  it('skips empty quoted phrases', () => {
    expect(parseSearchQuery('foo "" bar')).toEqual([
      { terms: 'foo', exact: false, urlOnly: false },
      { terms: 'bar', exact: false, urlOnly: false },
    ]);
  });

  it('collapses extra whitespace between terms', () => {
    expect(parseSearchQuery('  a   b  ')).toEqual([
      { terms: 'a', exact: false, urlOnly: false },
      { terms: 'b', exact: false, urlOnly: false },
    ]);
  });

  describe('link: URL operator', () => {
    it('parses link:<value> as a URL-only term', () => {
      expect(parseSearchQuery('link:google.com')).toEqual([
        { terms: 'google.com', exact: false, urlOnly: true },
      ]);
    });

    it('parses keyword + link: combinations in any order', () => {
      expect(parseSearchQuery('link:google.com keyword')).toEqual([
        { terms: 'google.com', exact: false, urlOnly: true },
        { terms: 'keyword', exact: false, urlOnly: false },
      ]);
      expect(parseSearchQuery('keyword link:google.com')).toEqual([
        { terms: 'keyword', exact: false, urlOnly: false },
        { terms: 'google.com', exact: false, urlOnly: true },
      ]);
    });

    it('parses multiple link: terms', () => {
      expect(parseSearchQuery('link:google.com link:maps')).toEqual([
        { terms: 'google.com', exact: false, urlOnly: true },
        { terms: 'maps', exact: false, urlOnly: true },
      ]);
    });

    it('parses a quoted link value', () => {
      expect(parseSearchQuery('link:"exact phrase"')).toEqual([
        { terms: 'exact phrase', exact: true, urlOnly: true },
      ]);
    });

    it('is case-insensitive for the operator and lowercases the value', () => {
      expect(parseSearchQuery('LINK:Google.Com')).toEqual([
        { terms: 'google.com', exact: false, urlOnly: true },
      ]);
    });

    it('treats a bare link: with no value as a literal keyword', () => {
      expect(parseSearchQuery('link:')).toEqual([{ terms: 'link:', exact: false, urlOnly: false }]);
      expect(parseSearchQuery('link: keyword')).toEqual([
        { terms: 'link:', exact: false, urlOnly: false },
        { terms: 'keyword', exact: false, urlOnly: false },
      ]);
    });

    it('degrades gracefully on an unbalanced quote in the link value', () => {
      // 'link:"foo — no closing quote; the bare value keeps the quote char.
      expect(parseSearchQuery('link:"foo')).toEqual([
        { terms: '"foo', exact: false, urlOnly: true },
      ]);
    });
  });
});
