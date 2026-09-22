import { describe, it, expect, beforeAll } from 'vitest';
import {
  renderBookmarkCards,
  toggleSelectBookmark,
  updateBatchActionBar,
  getBookmarkDomain,
  resolveFolderName,
  updateBookmarksHeader,
  createBookmarkCard,
} from '../src/views/bookmarks.js';
import {
  setBookmarks,
  setActiveFolder,
  selectedIds,
  sourceFiles,
  bookmarks,
} from '../src/core/state.js';

function makeEl() {
  return {
    dataset: {},
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
    style: {},
    inert: false,
    parentElement: null,
    _attrs: {},
    setAttribute(name, value) {
      this._attrs[name] = String(value);
    },
    getAttribute(name) {
      return this._attrs[name];
    },
    removeAttribute(name) {
      delete this._attrs[name];
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
      toggle(c, force) {
        const on = force === undefined ? !this._s.has(c) : Boolean(force);
        if (on) this._s.add(c);
        else this._s.delete(c);
        return on;
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
    expect(html).toContain('data-delete-bookmark');
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

describe('getBookmarkDomain', () => {
  it('strips www. from a valid URL', () => {
    expect(getBookmarkDomain('https://www.apple.com/x')).toBe('apple.com');
  });
  it('leaves non-www hostnames intact', () => {
    expect(getBookmarkDomain('https://news.ycombinator.com/item?id=1')).toBe(
      'news.ycombinator.com',
    );
  });
  it('falls back to web for an invalid URL', () => {
    expect(getBookmarkDomain('not a url')).toBe('web');
  });
});

describe('resolveFolderName', () => {
  it('returns 全部檔案 for the ALL folder', () => {
    setActiveFolder('ALL');
    expect(resolveFolderName()).toBe('全部檔案');
  });
  it('returns the source file name for a known folder', () => {
    setActiveFolder('f1');
    expect(resolveFolderName()).toBe('My Export.csv');
  });
  it('returns 未知 for an unknown folder', () => {
    setActiveFolder('missing');
    expect(resolveFolderName()).toBe('未知');
    setActiveFolder('ALL');
  });
});

describe('updateBookmarksHeader', () => {
  it('writes count, checkbox state and the filter summary', () => {
    setBookmarks([
      { id: '1', title: 't', url: 'https://a.com', source_file_id: 'f1' },
      { id: '2', title: 't', url: 'https://a.com', source_file_id: 'f1' },
    ]);
    updateBookmarksHeader(bookmarks);
    expect(els.filteredCount.innerText).toBe(2);
    expect(els.selectAllCheckbox.checked).toBe(false);
    expect(els.activeFilterSummary.innerText).toContain('全部檔案');
    expect(els.activeFilterSummary.innerText).toContain('符合: 2 筆');
  });
  it('checks selectAll when every visible bookmark is selected', () => {
    selectedIds.add('1');
    selectedIds.add('2');
    updateBookmarksHeader(bookmarks);
    expect(els.selectAllCheckbox.checked).toBe(true);
    selectedIds.clear();
  });
});

describe('createBookmarkCard', () => {
  it('builds a card element with markup, listeners and the delete button', () => {
    setBookmarks([
      {
        id: '1',
        title: 'Apple <News>',
        url: 'https://www.apple.com/x',
        instapaper_url: 'https://www.instapaper.com/read/1',
        article_preview: 'pie text',
        detected_language: 'en',
        source_file_name: 'My Export.csv',
        tags: ['tech', 'fruit'],
      },
    ]);
    const card = createBookmarkCard(bookmarks[0]);
    expect(card.className).toContain('bg-slate-800');
    expect(card.tabIndex).toBe(0); // keyboard-activatable card
    expect(card.innerHTML).toContain('Apple &lt;News&gt;');
    expect(card.innerHTML).toContain('📁 My Export.csv');
    expect(card.innerHTML).toContain('#tech');
    expect(card.innerHTML).toContain('apple.com');
    expect(card.innerHTML).toContain('data-delete-bookmark');
    expect(card.innerHTML).not.toContain('open-reader-btn');
    expect(card.innerHTML).not.toContain('📖 閱讀');
    expect(card.innerHTML).toContain('⚡ 相似');
    expect(card.innerHTML).toContain('href="https://www.instapaper.com/read/1"');
  });

  it('checks the checkbox when the bookmark is selected', () => {
    setBookmarks([{ id: '1', title: 'Apple <News>', url: 'https://www.apple.com/x', tags: [] }]);
    selectedIds.add('1');
    const card = createBookmarkCard(bookmarks[0]);
    expect(card.innerHTML).toContain('checked');
    selectedIds.delete('1');
  });

  it('derives the web domain fallback for invalid URLs', () => {
    setBookmarks([{ id: '2', title: 'Banana bread', url: 'not a url', tags: [] }]);
    const card = createBookmarkCard(bookmarks[0]);
    expect(card.innerHTML).toContain('web');
  });
});

describe('card click opens the reader', () => {
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

  it('opens the reader modal when the card body is clicked', () => {
    setBookmarks([bookmark]);
    const card = createBookmarkCard(bookmarks[0]);
    document.getElementById('readerModal'); // prime/cache the DOM stub
    els.readerModal.classList.add('hidden'); // force a closed starting state

    // e.target is the card padding (no interactive ancestor) -> opens reader
    card.listeners.click({ target: { closest: () => null } });

    expect(els.readerModal.classList.contains('hidden')).toBe(false);
    expect(els.readerTitle.innerText).toBe(bookmark.title);
  });

  it('does not open the reader when an inner control is clicked', () => {
    setBookmarks([bookmark]);
    const card = createBookmarkCard(bookmarks[0]);
    document.getElementById('readerModal');
    els.readerModal.classList.add('hidden');

    // e.target is inside a button -> the guard must bail (no reader open)
    card.listeners.click({
      target: { closest: (sel) => (sel.includes('button') ? {} : null) },
    });
    expect(els.readerModal.classList.contains('hidden')).toBe(true);
  });

  it('opens the reader on Enter/Space when the card itself is focused', () => {
    setBookmarks([bookmark]);
    const card = createBookmarkCard(bookmarks[0]);
    document.getElementById('readerModal');
    els.readerModal.classList.add('hidden');

    card.listeners.keydown({ target: card, key: 'Enter', preventDefault: () => {} });
    expect(els.readerModal.classList.contains('hidden')).toBe(false);

    els.readerModal.classList.add('hidden');
    card.listeners.keydown({ target: card, key: ' ', preventDefault: () => {} });
    expect(els.readerModal.classList.contains('hidden')).toBe(false);
  });

  it('ignores keydown whose target is not the card itself', () => {
    setBookmarks([bookmark]);
    const card = createBookmarkCard(bookmarks[0]);
    document.getElementById('readerModal');
    els.readerModal.classList.add('hidden');

    card.listeners.keydown({ target: {}, key: 'Enter', preventDefault: () => {} });
    expect(els.readerModal.classList.contains('hidden')).toBe(true);
  });
});
