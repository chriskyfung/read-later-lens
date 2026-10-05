import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  initTrash,
  registerTrashListeners,
  renderTrashView,
  createTrashItem,
  restoreBookmark,
  purgeBookmark,
  confirmPurgeBookmark,
  emptyTrash,
  confirmEmptyTrash,
} from '../src/views/trash.js';
import { setBookmarks, bookmarks, selectedIds, setSelectedIds } from '../src/core/state.js';
import { STALE_STATE_MESSAGE } from '../src/core/guard.js';

const OLDER = '2026-01-01T00:00:00.000Z';
const NEWER = '2026-02-01T00:00:00.000Z';

// The cross-tab gate is driven explicitly in `cross-tab stale gate` below; it
// must be transparent everywhere else, so it defaults to "fresh".
const gate = vi.hoisted(() => ({ fresh: true }));
vi.mock('../src/core/store.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isStateFresh: async () => gate.fresh,
}));

// ---- DOM stubs -----------------------------------------------------------
const els = {};
function makeEl() {
  const selectors = new Map();
  return {
    innerText: '',
    _html: '',
    className: '',
    _l: {},
    addEventListener(type, fn) {
      (this._l[type] = this._l[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      this._l[type] = (this._l[type] || []).filter((f) => f !== fn);
    },
    dispatch(type, ev) {
      // Returns a promise so an async handler can be awaited by the test; a
      // synchronous handler still runs to completion before dispatch returns.
      return Promise.all((this._l[type] || []).map((fn) => fn(ev || { stopPropagation() {} })));
    },
    classList: {
      _s: new Set(),
      add(...cs) {
        cs.forEach((c) => this._s.add(c));
      },
      remove(...cs) {
        cs.forEach((c) => this._s.delete(c));
      },
      contains(c) {
        return this._s.has(c);
      },
    },
    get innerHTML() {
      return this._html;
    },
    set innerHTML(html) {
      this._html = html;
      this.children = [];
      selectors.clear();
    },
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    querySelector(selector) {
      if (!selectors.has(selector)) selectors.set(selector, makeEl());
      return selectors.get(selector);
    },
    dataset: {},
  };
}
function el(id) {
  if (!els[id]) els[id] = makeEl();
  return els[id];
}

beforeAll(() => {
  globalThis.window = globalThis.window || {};
  globalThis.document = {
    getElementById: (id) => el(id),
    createElement: () => makeEl(),
  };
});

let persistFn;
let renderFn;

beforeEach(() => {
  for (const k of Object.keys(els)) delete els[k];
  gate.fresh = true;
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  setBookmarks([]);
  setSelectedIds(new Set());
  persistFn = vi.fn(async () => {});
  renderFn = vi.fn();
  initTrash({ persist: persistFn, render: renderFn });
});

const trashed = (id, title, deletedAt = OLDER) => ({
  id,
  title,
  article_preview: `${title} preview`,
  source_file_name: 'instapaper.csv',
  deleted_at: deletedAt,
});
const live = (id, title) => ({ id, title, article_preview: `${title} preview` });

describe('renderTrashView', () => {
  it('lists only trashed bookmarks, newest-deleted first, and hides the grid', () => {
    setBookmarks([live('a', 'Active'), trashed('1', 'Older', OLDER), trashed('2', 'Newer', NEWER)]);

    renderTrashView();

    const list = el('trashList');
    expect(list.children).toHaveLength(2);
    expect(list.children[0].innerHTML).toContain('Newer');
    expect(list.children[1].innerHTML).toContain('Older');
    expect(list.children[0].innerHTML).not.toContain('Active');

    expect(el('trashPanel').classList.contains('hidden')).toBe(false);
    expect(el('bookmarkCardsGrid').classList.contains('hidden')).toBe(true);
    expect(el('emptyState').classList.contains('hidden')).toBe(true);
    expect(el('trashEmptyState').classList.contains('hidden')).toBe(true);
    expect(el('trashSummary').innerText).toBe('共 2 筆');
    expect(el('filteredCount').innerText).toBe('2');
    expect(el('activeFilterSummary').innerText).toContain('目前分類: 回收桶');
    expect(el('selectAllCheckbox').checked).toBe(false);
  });

  it('shows the trash empty state when nothing is trashed', () => {
    setBookmarks([live('a', 'Active')]);

    renderTrashView();

    expect(el('trashList').children).toHaveLength(0);
    expect(el('trashEmptyState').classList.contains('hidden')).toBe(false);
    expect(el('trashSummary').innerText).toBe('共 0 筆');
  });

  describe('restoreBookmark', () => {
    it('clears the stamp, persists, re-renders and toasts', async () => {
      setBookmarks([trashed('1', 'Older')]);
      selectedIds.add('1');

      expect(await restoreBookmark('1')).toBe(true);

      expect(bookmarks[0].deleted_at).toBeNull();
      expect(selectedIds.has('1')).toBe(false);
      expect(persistFn).toHaveBeenCalledTimes(1);
      expect(renderFn).toHaveBeenCalledTimes(1);
      expect(el('toastMsg').innerText).toBe('已還原書籤「Older」');
    });

    it('ignores live or unknown ids', async () => {
      setBookmarks([live('1', 'Active')]);

      expect(await restoreBookmark('1')).toBe(false);
      expect(await restoreBookmark('missing')).toBe(false);
      expect(persistFn).not.toHaveBeenCalled();
    });
  });

  describe('purgeBookmark', () => {
    it('removes the record permanently and toasts', async () => {
      setBookmarks([trashed('1', 'Older'), live('2', 'Active')]);
      selectedIds.add('1');

      expect(await purgeBookmark('1')).toBe(true);

      expect(bookmarks.map((b) => b.id)).toEqual(['2']);
      expect(selectedIds.has('1')).toBe(false);
      expect(persistFn).toHaveBeenCalledTimes(1);
      expect(el('toastMsg').innerText).toBe('已永久刪除該筆書籤');
    });

    it('ignores unknown ids', async () => {
      expect(await purgeBookmark('missing')).toBe(false);
      expect(persistFn).not.toHaveBeenCalled();
    });
  });

  describe('confirmPurgeBookmark', () => {
    it('purges after the confirm is accepted', async () => {
      setBookmarks([trashed('1', 'Older')]);

      expect(await confirmPurgeBookmark('1')).toBe(true);

      expect(bookmarks).toHaveLength(0);
    });

    it('keeps the record when the confirm is declined', async () => {
      globalThis.confirm = vi.fn(() => false);
      setBookmarks([trashed('1', 'Older')]);

      expect(await confirmPurgeBookmark('1')).toBe(false);

      expect(bookmarks).toHaveLength(1);
      expect(persistFn).not.toHaveBeenCalled();
    });
  });

  describe('emptyTrash', () => {
    it('purges every trashed record and keeps the live ones', async () => {
      setBookmarks([trashed('1', 'Older'), trashed('2', 'Newer', NEWER), live('3', 'Active')]);
      selectedIds.add('1');
      selectedIds.add('3');

      expect(await emptyTrash()).toBe(true);

      expect(bookmarks.map((b) => b.id)).toEqual(['3']);
      expect(selectedIds.has('1')).toBe(false);
      expect(selectedIds.has('3')).toBe(true);
      expect(persistFn).toHaveBeenCalledTimes(1);
      expect(el('toastMsg').innerText).toBe('已清空回收桶（2 筆）');
    });

    it('does nothing when the trash is already empty', async () => {
      setBookmarks([live('1', 'Active')]);

      expect(await emptyTrash()).toBe(false);

      expect(bookmarks).toHaveLength(1);
      expect(persistFn).not.toHaveBeenCalled();
    });
  });

  describe('confirmEmptyTrash', () => {
    it('empties the trash after the confirm is accepted', async () => {
      setBookmarks([trashed('1', 'Older')]);

      expect(await confirmEmptyTrash()).toBe(true);

      expect(bookmarks).toHaveLength(0);
    });

    it('keeps the trash when the confirm is declined', async () => {
      globalThis.confirm = vi.fn(() => false);
      setBookmarks([trashed('1', 'Older')]);

      expect(await confirmEmptyTrash()).toBe(false);

      expect(bookmarks).toHaveLength(1);
      expect(persistFn).not.toHaveBeenCalled();
    });

    it('never prompts for an empty trash', async () => {
      const confirmSpy = vi.fn(() => true);
      globalThis.confirm = confirmSpy;

      expect(await confirmEmptyTrash()).toBe(false);
      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });

  describe('registerTrashListeners', () => {
    it('restores a row through the delegated click', async () => {
      registerTrashListeners();
      setBookmarks([trashed('1', 'Older')]);
      const button = { dataset: { restoreBookmark: '1' } };

      await el('trashList').dispatch('click', {
        target: { closest: (s) => (s === '[data-restore-bookmark]' ? button : null) },
      });

      expect(bookmarks[0].deleted_at).toBeNull();
      expect(persistFn).toHaveBeenCalledTimes(1);
    });

    it('purges a row through the delegated click (after confirm)', async () => {
      registerTrashListeners();
      setBookmarks([trashed('1', 'Older')]);
      const button = { dataset: { purgeBookmark: '1' } };

      await el('trashList').dispatch('click', {
        target: { closest: (s) => (s === '[data-purge-bookmark]' ? button : null) },
      });

      expect(bookmarks).toHaveLength(0);
      expect(persistFn).toHaveBeenCalledTimes(1);
    });

    it('ignores clicks that hit neither action button', async () => {
      registerTrashListeners();
      setBookmarks([trashed('1', 'Older')]);

      await el('trashList').dispatch('click', { target: { closest: () => null } });

      expect(bookmarks).toHaveLength(1);
      expect(persistFn).not.toHaveBeenCalled();
    });

    it('empties the trash from the panel button', async () => {
      registerTrashListeners();
      setBookmarks([trashed('1', 'Older'), live('2', 'Active')]);

      await el('emptyTrashBtn').dispatch('click');

      expect(bookmarks.map((b) => b.id)).toEqual(['2']);
    });
  });

  it('is a no-op when the panel is not mounted', () => {
    globalThis.document.getElementById = () => null;
    expect(() => renderTrashView()).not.toThrow();
    globalThis.document.getElementById = (id) => el(id);
  });
});

describe('cross-tab stale gate', () => {
  it('refuses a restore: the row stays trashed, nothing persists, and the reason is shown', async () => {
    const bookmark = trashed('1', 'Older', OLDER);
    setBookmarks([bookmark]);
    gate.fresh = false;

    expect(await restoreBookmark('1')).toBe(false);

    expect(bookmark.deleted_at).toBe(OLDER);
    expect(persistFn).not.toHaveBeenCalled();
    expect(el('toastMsg').innerText).toBe(STALE_STATE_MESSAGE);
  });

  it('refuses a purge without removing the record', async () => {
    setBookmarks([trashed('1', 'Older', OLDER)]);
    gate.fresh = false;

    expect(await purgeBookmark('1')).toBe(false);

    expect(bookmarks).toHaveLength(1);
    expect(persistFn).not.toHaveBeenCalled();
    expect(el('toastMsg').innerText).toBe(STALE_STATE_MESSAGE);
  });

  it('refuses to empty the trash, so no record is purged', async () => {
    setBookmarks([trashed('1', 'Older', OLDER), live('2', 'Active')]);
    gate.fresh = false;

    expect(await emptyTrash()).toBe(false);

    expect(bookmarks).toHaveLength(2);
    expect(persistFn).not.toHaveBeenCalled();
    expect(el('toastMsg').innerText).toBe(STALE_STATE_MESSAGE);
  });

  it('refuses the purge even once the confirm is accepted, so nothing is lost', async () => {
    const confirmSpy = vi.fn(() => true);
    globalThis.confirm = confirmSpy;
    setBookmarks([trashed('1', 'Older', OLDER)]);
    gate.fresh = false;

    expect(await confirmEmptyTrash()).toBe(false);

    // The prompt is asked first; the destructive step behind it is what refuses.
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(bookmarks).toHaveLength(1);
    expect(persistFn).not.toHaveBeenCalled();
    expect(el('toastMsg').innerText).toBe(STALE_STATE_MESSAGE);
  });
});

describe('createTrashItem', () => {
  it('renders the row and wires the restore / purge dataset ids', () => {
    const item = createTrashItem(trashed('7', '<b>Tagged</b>'));

    expect(item.className).toContain('bg-slate-800/60');
    expect(item.innerHTML).toContain('&lt;b&gt;Tagged&lt;/b&gt;');
    expect(item.innerHTML).toContain('instapaper.csv');
    expect(item.querySelector('[data-restore-bookmark]').dataset.restoreBookmark).toBe('7');
    expect(item.querySelector('[data-purge-bookmark]').dataset.purgeBookmark).toBe('7');
  });
});
