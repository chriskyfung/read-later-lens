import { describe, it, expect, beforeEach } from 'vitest';
import {
  setBookmarks,
  setActiveFolder,
  setActiveLang,
  setActiveTag,
  setSearchQuery,
  setSortBy,
} from '../src/core/state.js';
import {
  applyFilters,
  getFilteredBookmarks,
  getFilteredBookmarksTop,
} from '../src/core/filters.js';

const mk = (id, over = {}) => ({
  id: String(id),
  title: `Title ${id}`,
  url: `https://site${id}.example.com/a`,
  article_preview: `preview ${id}`,
  content: `content ${id}`,
  source_file_id: 'f1',
  source_file_name: 'f.csv',
  detected_language: 'en',
  tags: [],
  ...over,
});

beforeEach(() => {
  setBookmarks([]);
  setActiveFolder('ALL');
  setActiveLang('ALL');
  setActiveTag(null);
  setSearchQuery('');
  setSortBy('relevance');
});

describe('applyFilters', () => {
  it('does not mutate the input array when sorting (regression R1)', () => {
    const input = [mk(3), mk(1), mk(2)];
    const snapshot = input.map((b) => b.id);
    setSortBy('newer');
    const out = applyFilters(input);
    expect(input.map((b) => b.id)).toEqual(snapshot);
    expect(out).not.toBe(input);
    expect(out.map((b) => b.id)).toEqual(['3', '2', '1']);
  });

  it('leaves the master bookmarks array order untouched after sorting', () => {
    const list = [mk(3), mk(1), mk(2)];
    setBookmarks(list);
    setSortBy('older');
    getFilteredBookmarks();
    expect(list.map((b) => b.id)).toEqual(['3', '1', '2']);
  });

  it('filters by source folder', () => {
    setBookmarks([mk(1, { source_file_id: 'f1' }), mk(2, { source_file_id: 'f2' })]);
    setActiveFolder('f2');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['2']);
  });

  it('filters by language, including the "other" bucket', () => {
    setBookmarks([
      mk(1, { detected_language: 'en' }),
      mk(2, { detected_language: 'zh' }),
      mk(3, { detected_language: 'ko' }),
    ]);
    setActiveLang('zh');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['2']);
    setActiveLang('other');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['3']);
  });

  it('filters by tag', () => {
    setBookmarks([mk(1, { tags: ['news'] }), mk(2, { tags: ['tech'] })]);
    setActiveTag('tech');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['2']);
  });

  it('scores search hits and sorts by relevance', () => {
    setBookmarks([
      mk(1, { title: 'alpha', article_preview: 'nothing' }),
      mk(2, { article_preview: 'alpha' }),
      mk(3, { title: 'nosuchword' }),
    ]);
    setSearchQuery('alpha');
    setSortBy('relevance');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1', '2']);
  });

  it('matches multi-term queries regardless of term order (AND semantics)', () => {
    setBookmarks([
      mk(1, { title: 'term1 middle term2' }),
      mk(2, { title: 'term2 middle term1' }),
      mk(3, { title: 'term1 only' }),
      mk(4, { title: 'term2 only' }),
    ]);
    setSearchQuery('term1 term2');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1', '2']);
    setSearchQuery('term2 term1');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1', '2']);
  });

  it('matches an exact phrase only when it appears contiguously', () => {
    setBookmarks([mk(1, { title: 'term1 term2 end' }), mk(2, { title: 'term1 middle term2' })]);
    setSearchQuery('"term1 term2"');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1']);
  });

  it('combines bare terms and quoted phrases with AND', () => {
    setBookmarks([
      mk(1, { title: 'foo bar baz qux' }),
      mk(2, { title: 'foo bar baz missing' }), // no 'qux'
      mk(3, { title: 'foo bar baz' }), // phrase ok, no 'qux'
    ]);
    setSearchQuery('qux "bar baz"');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1']);
  });

  it('multi-term search is case-insensitive', () => {
    setBookmarks([mk(1, { title: 'ALPHA Beta' })]);
    setSearchQuery('alpha beta');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1']);
  });

  it('multi-term search matches across fields (title + tags)', () => {
    setBookmarks([
      mk(1, { title: 'alpha', tags: ['news'] }),
      mk(2, { title: 'alpha' }),
      mk(3, { title: 'other', tags: ['news'] }),
    ]);
    setSearchQuery('alpha news');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1']);
  });

  it('relevance sorting favors bookmarks matching more fields', () => {
    setBookmarks([
      mk(1, { title: 'alpha', tags: ['beta'] }), // title + tag
      mk(2, { title: 'alpha beta' }), // both terms in title → higher score
    ]);
    setSearchQuery('alpha beta');
    setSortBy('relevance');
    const ids = getFilteredBookmarks().map((b) => b.id);
    expect(ids).toEqual(['2', '1']);
  });

  it('sorts by title using zh-TW collation', () => {
    setBookmarks([mk(1, { title: 'banana' }), mk(2, { title: 'apple' })]);
    setSortBy('title_asc');
    expect(getFilteredBookmarks().map((b) => b.title)).toEqual(['apple', 'banana']);
  });
});

describe('getFilteredBookmarksTop', () => {
  it('caps the result set', () => {
    setBookmarks([mk(1), mk(2), mk(3), mk(4)]);
    expect(getFilteredBookmarksTop(2)).toHaveLength(2);
  });
});

describe('link: URL operator', () => {
  it('limits results to bookmarks whose URL contains the value', () => {
    setBookmarks([
      mk(1, { title: 'alpha', url: 'https://google.com/maps' }),
      mk(2, { title: 'google.com mentioned', url: 'https://other.org/x' }),
      mk(3, { url: 'https://google.com/search' }),
    ]);
    setSearchQuery('link:google.com');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1', '3']);
  });

  it('ANDs link: with keywords in any order', () => {
    setBookmarks([
      mk(1, { title: 'alpha', url: 'https://google.com/maps' }),
      mk(2, { title: 'beta', url: 'https://google.com/maps' }),
      mk(3, { title: 'alpha', url: 'https://other.org' }),
    ]);
    setSearchQuery('link:google.com alpha');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1']);
    setSearchQuery('alpha link:google.com');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1']);
  });

  it('does NOT match link: values in title, preview, or tags', () => {
    setBookmarks([
      mk(1, { title: 'google.com guide', url: 'https://other.org' }),
      mk(2, { tags: ['google.com'], url: 'https://other.org' }),
      mk(3, { article_preview: 'read google.com now', url: 'https://other.org' }),
    ]);
    setSearchQuery('link:google.com');
    expect(getFilteredBookmarks()).toEqual([]);
  });

  it('ANDs multiple link: terms together', () => {
    setBookmarks([
      mk(1, { url: 'https://maps.google.com/route' }),
      mk(2, { url: 'https://google.com' }),
    ]);
    setSearchQuery('link:google.com link:maps');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1']);
  });

  it('is case-insensitive for both the operator and the value', () => {
    setBookmarks([mk(1, { url: 'https://docs.GOOGLE.com' }), mk(2, { url: 'https://other.org' })]);
    setSearchQuery('LINK:google.com');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1']);
  });

  it('treats a bare link: with no value as a literal keyword', () => {
    setBookmarks([mk(1, { title: 'what is link:' }), mk(2, { title: 'nothing relevant' })]);
    setSearchQuery('link:');
    expect(getFilteredBookmarks().map((b) => b.id)).toEqual(['1']);
  });
});
