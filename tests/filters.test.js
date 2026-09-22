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
