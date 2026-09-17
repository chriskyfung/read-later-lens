import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  initSidebarActions,
  registerSidebarListeners,
  selectFolder,
  confirmDeleteFolder,
  deleteFolder,
  updateStorageUsageUI,
} from '../src/views/sidebarActions.js';
import {
  setBookmarks,
  setSourceFiles,
  setActiveFolder,
  setActiveLang,
  activeFolder,
  activeLang,
  sourceFiles,
} from '../src/core/state.js';

// ---- DOM stubs -----------------------------------------------------------
const els = {};
function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    style: {},
    dataset: {},
    _l: {},
    addEventListener(type, fn) { (this._l[type] = this._l[type] || []).push(fn); },
    removeEventListener(type, fn) {
      this._l[type] = (this._l[type] || []).filter((f) => f !== fn);
    },
    dispatch(type, ev) {
      (this._l[type] || []).forEach((fn) => fn(ev || { stopPropagation() {} }));
    },
    classList: {
      _s: new Set(),
      add(...cs) { cs.forEach((c) => this._s.add(c)); },
      remove(...cs) { cs.forEach((c) => this._s.delete(c)); },
      contains(c) { return this._s.has(c); },
    },
    children: [],
    appendChild(c) { this.children.push(c); },
    onclick: null,
  };
}
function el(id) {
  if (!els[id]) els[id] = makeEl();
  return els[id];
}

beforeAll(() => {
  globalThis.window = globalThis.window || {};
  globalThis.document = {
    // Auto-create elements like a real DOM after mountSidebar() has run.
    getElementById: (id) => el(id),
    createElement: () => makeEl(),
    querySelectorAll: (sel) =>
      sel === '.lang-btn' ? [el('langAll'), el('langEn'), el('langZh')] : [],
  };
});

beforeEach(() => {
  for (const k of Object.keys(els)) delete els[k];
  vi.stubGlobal('confirm', vi.fn(() => true));
  setBookmarks([]);
  setSourceFiles(new Map());
  setActiveFolder('ALL');
  setActiveLang('ALL');
  initSidebarActions({
    persist: vi.fn(async () => {}),
    render: vi.fn(),
  });
});

describe('selectFolder', () => {
  it('sets activeFolder and re-renders without persisting', () => {
    const renderFn = vi.fn();
    const persistFn = vi.fn(async () => {});
    initSidebarActions({ persist: persistFn, render: renderFn });

    selectFolder('F1');

    expect(activeFolder).toBe('F1');
    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(persistFn).not.toHaveBeenCalled();
  });
});

describe('confirmDeleteFolder', () => {
  it('delegates to deleteFolder after confirm and stops propagation', async () => {
    const stopPropagation = vi.fn();
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv' }]]));
    setBookmarks([{ id: '1', source_file_id: 'F1' }]);

    const renderFn = vi.fn();
    const persistFn = vi.fn(async () => {});
    initSidebarActions({ persist: persistFn, render: renderFn });

    confirmDeleteFolder({ stopPropagation }, 'F1');
    await new Promise((r) => setTimeout(r, 0));

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(sourceFiles.has('F1')).toBe(false);
    expect(persistFn).toHaveBeenCalledTimes(1);
    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(el('toastMsg').innerText).toBe('已成功刪除檔案及其書籤');
  });

  it('cancel path keeps the file', () => {
    globalThis.confirm = vi.fn(() => false);
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv' }]]));

    const stopPropagation = vi.fn();
    confirmDeleteFolder({ stopPropagation }, 'F1');

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(sourceFiles.has('F1')).toBe(true);
  });

  it('tolerates unknown file ids in the confirm message', () => {
    const stopPropagation = vi.fn();
    globalThis.confirm = vi.fn(() => false);
    expect(() => confirmDeleteFolder({ stopPropagation }, 'missing')).not.toThrow();
  });
});
// END-PART1

describe('deleteFolder', () => {
  it('removes file + bookmarks, resets activeFolder, persists, renders and toasts', async () => {
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv' }]]));
    setBookmarks([
      { id: '1', source_file_id: 'F1' },
      { id: '2', source_file_id: 'OTHER' },
    ]);
    setActiveFolder('F1');

    const renderFn = vi.fn();
    const persistFn = vi.fn(async () => {});
    initSidebarActions({ persist: persistFn, render: renderFn });

    deleteFolder('F1');
    await new Promise((r) => setTimeout(r, 0));

    expect(sourceFiles.has('F1')).toBe(false);
    const { bookmarks } = await import('../src/core/state.js');
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].id).toBe('2');
    expect(activeFolder).toBe('ALL');
    expect(persistFn).toHaveBeenCalledTimes(1);
    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(el('toastMsg').innerText).toBe('已成功刪除檔案及其書籤');
  });

  it('triggerRender=false persists only (importer overwrite path)', async () => {
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv' }]]));
    const renderFn = vi.fn();
    const persistFn = vi.fn(async () => {});
    initSidebarActions({ persist: persistFn, render: renderFn });

    deleteFolder('F1', false);
    await new Promise((r) => setTimeout(r, 0));

    expect(persistFn).toHaveBeenCalledTimes(1);
    expect(renderFn).not.toHaveBeenCalled();
    expect(el('toastMsg').innerText).toBe(''); // no toast
  });

  it('does not touch activeFolder when another folder is selected', () => {
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv' }]]));
    setActiveFolder('OTHER');
    deleteFolder('F1', false);
    expect(activeFolder).toBe('OTHER');
  });
});

describe('registerSidebarListeners', () => {
  it('allFolderBtn resets the folder to ALL and re-renders', () => {
    const renderFn = vi.fn();
    initSidebarActions({ persist: vi.fn(async () => {}), render: renderFn });
    registerSidebarListeners();
    setActiveFolder('F1');

    el('allFolderBtn').dispatch('click');

    expect(activeFolder).toBe('ALL');
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('language pill clicks juggle classes, set activeLang and re-render', () => {
    const renderFn = vi.fn();
    initSidebarActions({ persist: vi.fn(async () => {}), render: renderFn });
    registerSidebarListeners();

    const target = makeEl();
    target.classList.add('lang-btn');
    target.dataset.lang = 'zh';
    el('languageFilters').dispatch('click', { target });

    // Other pills lose the active styling; the clicked pill gains it.
    expect(el('langAll').classList.contains('active')).toBe(false);
    expect(el('langAll').classList.contains('bg-slate-700')).toBe(true);
    expect(el('langEn').classList.contains('bg-indigo-600')).toBe(false);
    expect(target.classList.contains('active')).toBe(true);
    expect(target.classList.contains('bg-indigo-600')).toBe(true);
    expect(target.classList.contains('text-white')).toBe(true);
    expect(activeLang).toBe('zh');
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks that are not on .lang-btn pills', () => {
    const renderFn = vi.fn();
    initSidebarActions({ persist: vi.fn(async () => {}), render: renderFn });
    registerSidebarListeners();

    const target = makeEl(); // no lang-btn class
    el('languageFilters').dispatch('click', { target });

    expect(activeLang).toBe('ALL');
    expect(renderFn).not.toHaveBeenCalled();
  });
});

describe('updateStorageUsageUI', () => {
  it('writes the usage text and percentage width', async () => {
    const store = await import('../src/core/store.js');
    vi.spyOn(store, 'getStorageUsage').mockResolvedValue({ usageKB: 512, limitMB: 50 });

    await updateStorageUsageUI();

    expect(el('storageUsageText').innerText).toBe('512 KB / 50 MB');
    expect(el('storageProgressBar').style.width).toBe(`${Math.min(100, (512 / (50 * 1024)) * 100)}%`);
  });
});

