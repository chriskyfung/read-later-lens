import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  initWorkspaceActions,
  registerWorkspaceListeners,
  switchTab,
  deleteBookmark,
} from '../src/views/workspaceActions.js';
import {
  setBookmarks,
  setSortBy,
  setSelectedIds,
  selectedIds,
  sortBy,
  setSourceFiles,
} from '../src/core/state.js';
import { getFilteredBookmarks } from '../src/core/filters.js';
import { renderBookmarkCards, updateBatchActionBar } from '../src/views/bookmarks.js';

// Isolate the pure view collaborators.
vi.mock('../src/views/tabs.js', () => ({ activateTab: vi.fn() }));
vi.mock('../src/views/wordcloud.js', () => ({ renderWordCloud: vi.fn() }));
vi.mock('../src/views/domains.js', () => ({ renderDomainChart: vi.fn() }));
vi.mock('../src/views/linkage.js', () => ({
  renderConceptLinkageGraph: vi.fn(),
  zoomGraphBy: vi.fn(),
  resetGraphZoom: vi.fn(),
}));
vi.mock('../src/core/state.js', () => {
  const state = {
    bookmarks: [],
    selectedIds: new Set(),
  };
  return {
    setBookmarks: vi.fn((b) => { state.bookmarks = b; }),
    setSortBy: vi.fn(),
    setSelectedIds: vi.fn((s) => { state.selectedIds = s; }),
    get selectedIds() { return state.selectedIds; },
    get bookmarks() { return state.bookmarks; },
    sortBy: vi.fn(),
    setSourceFiles: vi.fn(),
  };
});
vi.mock('../src/core/filters.js', () => ({
  getFilteredBookmarks: vi.fn(),
}));
vi.mock('../src/views/bookmarks.js', () => ({
  renderBookmarkCards: vi.fn(),
  updateBatchActionBar: vi.fn(),
}));

const { activateTab } = await import('../src/views/tabs.js');
const { renderWordCloud } = await import('../src/views/wordcloud.js');
const { renderDomainChart } = await import('../src/views/domains.js');
const { renderConceptLinkageGraph, zoomGraphBy, resetGraphZoom } =
  await import('../src/views/linkage.js');

// ---- DOM stubs -----------------------------------------------------------
const els = {};
function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    checked: false,
    _l: {},
    addEventListener(type, fn) {
      (this._l[type] = this._l[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      this._l[type] = (this._l[type] || []).filter((f) => f !== fn);
    },
    dispatch(type, ev) {
      (this._l[type] || []).forEach((fn) => fn(ev || { stopPropagation() {} }));
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
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    onclick: null,
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
    // Auto-create elements like a real DOM after mountWorkspace() has run.
    getElementById: (id) => el(id),
    createElement: () => makeEl(),
    querySelectorAll: (sel) =>
      sel === '.main-tab'
        ? [el('tabBookmarks'), el('tabWordcloud'), el('tabDomains'), el('tabLinkage')]
        : [],
  };
});

beforeEach(() => {
  for (const k of Object.keys(els)) delete els[k];
  setBookmarks([]);
  setSourceFiles(new Map());
  setSortBy('relevance');
  setSelectedIds(new Set());
  initWorkspaceActions({
    persist: vi.fn(async () => {}),
    render: vi.fn(),
  });
});

describe('switchTab', () => {
  it('activates the requested tab and renders corresponding panel', async () => {
    switchTab('wordcloud');
    expect(activateTab).toHaveBeenCalledWith('wordcloud');
    expect(renderWordCloud).toHaveBeenCalled();

    switchTab('domains');
    expect(activateTab).toHaveBeenCalledWith('domains');
    expect(renderDomainChart).toHaveBeenCalled();

    switchTab('linkage');
    expect(activateTab).toHaveBeenCalledWith('linkage');
    expect(renderConceptLinkageGraph).toHaveBeenCalled();

    switchTab('bookmarks');
    expect(activateTab).toHaveBeenCalledWith('bookmarks');
    // Bookmarks panel is static/managed by renderBookmarkCards, not a separate render call in switchTab.
  });
});

describe('deleteBookmark', () => {
  it('removes bookmark from state, clears selection, persists and renders', async () => {
    const mockPersist = vi.fn();
    const mockRender = vi.fn();
    initWorkspaceActions({ persist: mockPersist, render: mockRender });

    const b1 = { id: '1', title: 'T1' };
    const b2 = { id: '2', title: 'T2' };
    setBookmarks([b1, b2]);
    selectedIds.add('1');

    deleteBookmark('1');

    expect(setBookmarks).toHaveBeenCalledWith([b2]);
    expect(selectedIds.has('1')).toBe(false);
    expect(mockPersist).toHaveBeenCalled();
    expect(mockRender).toHaveBeenCalled();
    expect(updateBatchActionBar).toHaveBeenCalled();
  });
});

describe('registerWorkspaceListeners', () => {
  it('wires the sortSelect dropdown', () => {
    registerWorkspaceListeners();
    const sortSel = el('sortSelect');
    sortSel.dispatch('change', { target: { value: 'newer' } });
    expect(setSortBy).toHaveBeenCalledWith('newer');
  });

  it('wires the tab buttons', () => {
    registerWorkspaceListeners();
    const tabs = document.querySelectorAll('.main-tab');
    tabs[0].dataset.tab = 'bookmarks';
    tabs[0].dispatch('click');
    expect(activateTab).toHaveBeenCalledWith('bookmarks');
  });

  it('wires the selectAllCheckbox', () => {
    registerWorkspaceListeners();
    const checkbox = el('selectAllCheckbox');
    const b1 = { id: '1' },
      b2 = { id: '2' };
    getFilteredBookmarks.mockReturnValue([b1, b2]);

    checkbox.checked = true;
    checkbox.dispatch('change', { target: { checked: true } });
    expect(selectedIds.has('1')).toBe(true);
    expect(selectedIds.has('2')).toBe(true);
    expect(renderBookmarkCards).toHaveBeenCalled();
    expect(updateBatchActionBar).toHaveBeenCalled();

    checkbox.checked = false;
    checkbox.dispatch('change', { target: { checked: false } });
    expect(selectedIds.size).toBe(0);
    expect(renderBookmarkCards).toHaveBeenCalled();
  });

  it('wires the batchDeleteBtn', () => {
    const mockPersist = vi.fn();
    const mockRender = vi.fn();
    initWorkspaceActions({ persist: mockPersist, render: mockRender });

    registerWorkspaceListeners();
    const b1 = { id: '1' },
      b2 = { id: '2' };
    setBookmarks([b1, b2]);
    selectedIds.add('1');

    el('batchDeleteBtn').dispatch('click');

    expect(setBookmarks).toHaveBeenCalledWith([b2]);
    expect(selectedIds.size).toBe(0);
    expect(mockPersist).toHaveBeenCalled();
    expect(mockRender).toHaveBeenCalled();
    expect(updateBatchActionBar).toHaveBeenCalled();
  });

  it('wires the batchCancelBtn', () => {
    registerWorkspaceListeners();
    selectedIds.add('1');
    el('batchCancelBtn').dispatch('click');
    expect(selectedIds.size).toBe(0);
    expect(renderBookmarkCards).toHaveBeenCalled();
    expect(updateBatchActionBar).toHaveBeenCalled();
  });

  it('wires D3 zoom controls', () => {
    registerWorkspaceListeners();
    el('zoomInBtn').dispatch('click');
    expect(zoomGraphBy).toHaveBeenCalledWith(1.3);
    el('zoomOutBtn').dispatch('click');
    expect(zoomGraphBy).toHaveBeenCalledWith(1 / 1.3);
    el('resetGraphBtn').dispatch('click');
    expect(resetGraphZoom).toHaveBeenCalled();
  });
});
