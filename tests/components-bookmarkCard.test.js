import { describe, it, expect } from 'vitest';
import { bookmarkCardClass, bookmarkCardHtml } from '../src/components/bookmarks/card.js';

// Minimal record mirroring tests/views-bookmarks.test.js fixtures.
const bookmark = {
  id: '1',
  title: 'Apple <News>',
  url: 'https://www.apple.com/x',
  instapaper_url: 'https://www.instapaper.com/read/1',
  article_preview: 'pie text',
  detected_language: 'en',
  source_file_name: 'My Export.csv',
  tags: ['tech', 'fruit'],
};

describe('bookmarkCardClass', () => {
  it('highlights a selected card with the indigo ring', () => {
    const cls = bookmarkCardClass(true);
    expect(cls).toContain('border-indigo-500 ring-1 ring-indigo-500');
  });

  it('uses the muted border for an unselected card', () => {
    const cls = bookmarkCardClass(false);
    expect(cls).toContain('border-slate-700/80 hover:border-slate-600');
    expect(cls).not.toContain('border-indigo-500 ring-1');
  });

  it('is keyboard-focusable (cursor-pointer + focus ring)', () => {
    const cls = bookmarkCardClass(false);
    expect(cls).toContain('cursor-pointer');
    expect(cls).toContain('focus-visible:ring-2 focus-visible:ring-indigo-500');
  });
});

describe('bookmarkCardHtml', () => {
  it('escapes the title and omits checked for an unselected card', () => {
    const html = bookmarkCardHtml({ bookmark, domain: 'apple.com', isSelected: false });
    expect(html).toContain('Apple &lt;News&gt;');
    expect(html).not.toContain('checked');
  });

  it('checks the checkbox when selected', () => {
    const html = bookmarkCardHtml({ bookmark, domain: 'apple.com', isSelected: true });
    expect(html).toContain('checked');
  });

  it('falls back to the 無預覽內容 placeholder when preview is empty', () => {
    const html = bookmarkCardHtml({
      bookmark: { ...bookmark, article_preview: '' },
      domain: 'web',
      isSelected: false,
    });
    expect(html).toContain('無預覽內容');
  });

  it('renders every #tag', () => {
    const html = bookmarkCardHtml({ bookmark, domain: 'apple.com', isSelected: false });
    expect(html).toContain('#tech');
    expect(html).toContain('#fruit');
  });

  it('renders no tag pills when the tag list is empty', () => {
    const html = bookmarkCardHtml({
      bookmark: { ...bookmark, tags: [] },
      domain: 'apple.com',
      isSelected: false,
    });
    expect(html).not.toContain('#tech');
  });

  it('emits the original-site and Instapaper links with their tooltips', () => {
    const html = bookmarkCardHtml({ bookmark, domain: 'apple.com', isSelected: false });
    expect(html).toContain('href="https://www.apple.com/x"');
    expect(html).toContain('title="前往原始網站"');
    expect(html).toContain('href="https://www.instapaper.com/read/1"');
    expect(html).toContain('title="於 Instapaper 開啟"');
  });

  it('renders the delete and similarity buttons (reader opens on card click)', () => {
    const html = bookmarkCardHtml({ bookmark, domain: 'apple.com', isSelected: false });
    expect(html).toContain('data-delete-bookmark');
    expect(html).toContain('open-similarity-btn');
    expect(html).toContain('⚡ 相似');
    expect(html).not.toContain('open-reader-btn');
    expect(html).not.toContain('📖 閱讀');
  });

  it('renders badges: language, domain and source file with its tooltip', () => {
    const html = bookmarkCardHtml({ bookmark, domain: 'apple.com', isSelected: false });
    expect(html).toContain(`>${bookmark.detected_language}<`); // raw, CSS uppercases it
    expect(html).toContain('apple.com');
    expect(html).toContain('📁 My Export.csv');
    expect(html).toContain('title="My Export.csv"');
  });
});
