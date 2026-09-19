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
      { terms: 'term1', exact: false },
      { terms: 'term2', exact: false },
    ]);
  });

  it('treats a quoted phrase as one exact term', () => {
    expect(parseSearchQuery('"term1 term2"')).toEqual([
      { terms: 'term1 term2', exact: true },
    ]);
  });

  it('supports mixing bare terms and quoted phrases', () => {
    expect(parseSearchQuery('foo "bar baz" qux')).toEqual([
      { terms: 'foo', exact: false },
      { terms: 'bar baz', exact: true },
      { terms: 'qux', exact: false },
    ]);
  });

  it('supports multiple quoted phrases', () => {
    expect(parseSearchQuery('"a b" "c d"')).toEqual([
      { terms: 'a b', exact: true },
      { terms: 'c d', exact: true },
    ]);
  });

  it('lowercases all terms', () => {
    expect(parseSearchQuery('Alpha "Beta Gamma"')).toEqual([
      { terms: 'alpha', exact: false },
      { terms: 'beta gamma', exact: true },
    ]);
  });

  it('handles an unbalanced trailing quote gracefully (literal term)', () => {
    // '"foo bar' — the bare segment keeps the quote character.
    expect(parseSearchQuery('"foo bar')).toEqual([
      { terms: '"foo', exact: false },
      { terms: 'bar', exact: false },
    ]);
  });

  it('skips empty quoted phrases', () => {
    expect(parseSearchQuery('foo "" bar')).toEqual([
      { terms: 'foo', exact: false },
      { terms: 'bar', exact: false },
    ]);
  });

  it('collapses extra whitespace between terms', () => {
    expect(parseSearchQuery('  a   b  ')).toEqual([
      { terms: 'a', exact: false },
      { terms: 'b', exact: false },
    ]);
  });
});
