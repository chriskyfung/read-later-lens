import { describe, it, expect, beforeAll } from 'vitest';
import {
  renderBookmarkCards,
  toggleSelectBookmark,
  updateBatchActionBar,
} from '../src/views/bookmarks.js';
import { setBookmarks, setActiveFolder, selectedIds, sourceFiles } from '../src/core/state.js';

function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    checked: false,
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    querySelector() {
      return makeEl();
    },
    classList: {
      _s: new Set(['hidden']),
      add(c) {
        this._s.add(c);
      },
      remove(c) {
        this._s.delete(c);
      },
      contains(c) {
        return this._s.has(c);
      },
    },
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
  };
}

const els = {};
const created = [];

beforeAll(() => {
  globalThis.document = globalThis.document || {};
  globalThis.document.getElementById = (id) => {
    if (!els[id]) els[id] = makeEl();
    return els[id];
  };
  globalThis.document.createElement = () => {
    const e = makeEl();
    created.push(e);
    return e;
  };
  globalThis.window = globalThis.window || {};

  sourceFiles.set('f1', { id: 'f1', name: 'My Export.csv', type: 'csv' });
  setActiveFolder('ALL');

  setBookmarks([
    {
      id: '1',
      title: 'Apple <News>',
      url: 'https://www.apple.com/x',
      article_preview: 'pie text',
      content: '',
      instapaper_url: 'https://www.instapaper.com/read/1',
      detected_language: 'en',
      tags: ['tech', 'fruit'],
      source_file_id: 'f1',
      source_file_name: 'My Export.csv',
    },
    {
      id: '2',
      title: 'Banana bread',
      url: 'not a url',
      article_preview: '',
      content: '',
      instapaper_url: 'https://www.instapaper.com/read/2',
      detected_language: 'zh',
      tags: [],
      source_file_id: 'f1',
      source_file_name: 'My Export.csv',
    },
  ]);
});

describe('renderBookmarkCards', () => {
  it('updates header side-effects and builds monolith-parity cards', () => {
    renderBookmarkCards();

    expect(els.filteredCount.innerText).toBe(2);
    expect(els.activeFilterSummary.innerText).toContain('全部檔案');
    expect(els.activeFilterSummary.innerText).toContain('符合: 2 筆');
    expect(els.selectAllCheckbox.checked).toBe(false);
    expect(els.emptyState.classList.contains('hidden')).toBe(true);

    expect(created.length).toBe(2);
    const html = created.map((c) => c.innerHTML).join('');

    // Escaped title, preview fallback string, badges, all # tags, links, delete
    expect(html).toContain('Apple &lt;News&gt;');
    expect(html).toContain('無預覽內容');
    expect(html).toContain('apple.com'); // www. stripped domain badge
    expect(html).toContain('web'); // invalid URL domain fallback
    expect(html).toContain('📁 My Export.csv');
    expect(html).toContain('#tech');
    expect(html).toContain('#fruit');
    expect(html).toContain('href="https://www.instapaper.com/read/1"');
    expect(html).toContain('onclick="window.IBM.deleteBookmark(\'1\')"');
    expect(html).toContain('zh'); // raw detected_language (CSS uppercases it)
  });

  it('shows the dedicated empty state when nothing matches', () => {
    setBookmarks([]);
    const before = created.length;
    renderBookmarkCards();
    expect(created.length).toBe(before); // no new cards
    expect(els.emptyState.classList.contains('hidden')).toBe(false);
    expect(els.filteredCount.innerText).toBe(0);
    setBookmarks([
      {
        id: '1',
        title: 'Apple <News>',
        url: 'https://www.apple.com/x',
        article_preview: 'pie text',
        content: '',
        instapaper_url: 'https://www.instapaper.com/read/1',
        detected_language: 'en',
        tags: ['tech', 'fruit'],
        source_file_id: 'f1',
        source_file_name: 'My Export.csv',
      },
      {
        id: '2',
        title: 'Banana bread',
        url: 'not a url',
        article_preview: '',
        content: '',
        instapaper_url: 'https://www.instapaper.com/read/2',
        detected_language: 'zh',
        tags: [],
        source_file_id: 'f1',
        source_file_name: 'My Export.csv',
      },
    ]);
  });

  it('reflects folder name and 未知 for unknown folders', () => {
    setActiveFolder('f1');
    renderBookmarkCards();
    expect(els.activeFilterSummary.innerText).toContain('My Export.csv');
    setActiveFolder('missing');
    renderBookmarkCards();
    expect(els.activeFilterSummary.innerText).toContain('未知');
    setActiveFolder('ALL');
  });
});

describe('toggleSelectBookmark', () => {
  it('mutates the live set and updates the batch bar without re-rendering cards', () => {
    created.length = 0;
    selectedIds.clear();
    updateBatchActionBar(); // creates the bar/count stubs with an empty selection
    expect(els.batchActionBar.classList.contains('hidden')).toBe(true);

    toggleSelectBookmark('1');
    expect(selectedIds.has('1')).toBe(true);
    expect(created.length).toBe(0); // no card re-render (monolith parity)
    expect(els.selectedCount.innerText).toBe(1);
    expect(els.batchActionBar.classList.contains('hidden')).toBe(false);
    expect(els.batchActionBar.classList.contains('flex')).toBe(true);

    toggleSelectBookmark('1');
    expect(selectedIds.has('1')).toBe(false);
    expect(els.batchActionBar.classList.contains('hidden')).toBe(true);
    expect(els.batchActionBar.classList.contains('flex')).toBe(false);
  });
});

describe('updateBatchActionBar', () => {
  it('reflects the current selection size', () => {
    selectedIds.add('1');
    selectedIds.add('2');
    updateBatchActionBar();
    expect(els.selectedCount.innerText).toBe(2);
    expect(els.batchActionBar.classList.contains('flex')).toBe(true);
    selectedIds.clear();
    updateBatchActionBar();
    expect(els.batchActionBar.classList.contains('hidden')).toBe(true);
  });
});
