import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderSidebarFolders, renderTagCloud, renderSidebar } from '../src/views/sidebar.js';
import { initSidebarActions, registerSidebarListeners } from '../src/views/sidebarActions.js';
import * as state from '../src/core/state.js';

// Model only the DOM operations used by the sidebar, including replacement
// and removal so repeated-render tests detect stale or duplicate children.
function makeEl() {
  return {
    querySelector(selector) {
      this.elements ||= {};
      return this.elements[selector] ||= makeEl();
    },
    innerText: '',
    dataset: {},
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    closest() { return this; },
    className: '',
    children: [],
    parent: null,
    _html: '',
    get innerHTML() {
      return this._html;
    },
    set innerHTML(value) {
      this._html = value;
      this.children = [];
    },
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
    },
    querySelectorAll(selector) {
      return this.children.filter((child) =>
        child.className.split(' ').includes(selector.slice(1)),
      );
    },
    remove() {
      this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = null;
    },
  };
}

let els;
let requestRender;
const ids = ['folderList', 'allFolderBtn', 'totalSourceCount', 'allCountBadge', 'tagFilterCloud'];
function resetState() {
  state.setBookmarks([]);
  state.setSourceFiles(new Map());
  state.setActiveFolder('ALL');
  state.setActiveTag(null);
  state.setActiveLang('ALL');
  state.setSearchQuery('');
}
beforeEach(() => {
  resetState();
  els = Object.fromEntries(ids.map((id) => [id, makeEl()]));
  requestRender = vi.fn();
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {
    getElementById: (id) => els[id] || null,
    createElement: () => makeEl(),
  });
  state.setSourceFiles(
    new Map([
      ['f1', { id: 'f1', name: 'Export.csv', type: 'csv' }],
      ['f2', { id: 'f2', name: 'Export.json', type: 'json' }],
      ['f3', { id: 'f3', name: 'Export.db', type: 'db' }],
    ]),
  );
  state.setBookmarks([
    { id: '1', source_file_id: 'f1', tags: [' tech ', 'tech', ' ', 'fruit'] },
    { id: '2', source_file_id: 'f1', tags: ['fruit', 'news'] },
    { id: '3', source_file_id: 'f2', tags: ['news'] },
  ]);
});
afterEach(() => {
  resetState();
  vi.unstubAllGlobals();
});

describe('renderSidebarFolders', () => {
  it('preserves counts, insertion order, type badges and inline handlers', () => {
    renderSidebarFolders();
    expect(els.totalSourceCount.innerText).toBe('3');
    expect(els.allCountBadge.innerText).toBe('3');
    expect(els.allFolderBtn.className).toBe(
      'folder-btn active w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between bg-indigo-600/20 text-indigo-300 border border-indigo-500/30',
    );
    const rows = els.folderList.children;
    expect(rows).toHaveLength(3);
    const colors = ['amber', 'emerald', 'sky'];
    const counts = [2, 1, 0];
    [...state.sourceFiles.values()].forEach((file, i) => {
      expect(rows[i].innerHTML).toContain(`>${file.name}</span>`);
      expect(rows[i].innerHTML).toContain(`bg-${colors[i]}-900/60 text-${colors[i]}-200`);
      expect(rows[i].innerHTML).toContain(`shrink-0">${file.type}</span>`);
      expect(rows[i].innerHTML).toContain(`rounded">${counts[i]}</span>`);
      expect(rows[i].dataset.selectFolder).toBe(file.id);
      expect(rows[i].querySelector('[data-delete-folder]').dataset.deleteFolder).toBe(file.id);
      expect(rows[i].innerHTML).toContain('title="刪除檔案與其書籤"');
    });
  });

  it('replaces only dynamic rows and observes replaced state bindings', () => {
    const staticControl = makeEl();
    els.folderList.appendChild(staticControl);
    renderSidebarFolders();
    const oldRows = els.folderList.children.slice(1);
    state.setActiveFolder('f2');
    state.setSourceFiles(new Map([['f2', state.sourceFiles.get('f2')]]));
    state.setBookmarks([]);
    renderSidebarFolders();
    expect(els.folderList.children).toHaveLength(2);
    expect(els.folderList.children[0]).toBe(staticControl);
    oldRows.forEach((row) => expect(row.parent).toBeNull());
    expect(els.folderList.children[1].className).toContain(
      'bg-indigo-600/20 text-indigo-300 border-indigo-500/30',
    );
    expect(els.allFolderBtn.className).toBe(
      'folder-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between text-slate-300 border border-transparent hover:bg-slate-700/50',
    );
    expect(els.totalSourceCount.innerText).toBe('1');
    expect(els.allCountBadge.innerText).toBe('0');
  });
});
describe('renderTagCloud', () => {
  it('trims, counts occurrences (not unique bookmarks), and preserves first-seen order', () => {
    state.setActiveFolder('f2');
    state.setActiveTag('news');
    state.setActiveLang('zh');
    state.setSearchQuery('no match');
    renderTagCloud();
    expect(els.tagFilterCloud.children.map((pill) => pill.innerText)).toEqual([
      '#tech (2)',
      '#fruit (2)',
      '#news (2)',
    ]);
    expect(els.tagFilterCloud.children[0].className).toBe(
      'text-[11px] px-2 py-0.5 rounded-full border transition bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700',
    );
    expect(els.tagFilterCloud.children[2].className).toBe(
      'text-[11px] px-2 py-0.5 rounded-full border transition bg-indigo-600 text-white border-indigo-400 font-semibold',
    );
    renderTagCloud();
    expect(els.tagFilterCloud.children).toHaveLength(3);
  });

  it('replaces old pills with the exact empty placeholder for missing, non-array or blank tags', () => {
    renderTagCloud();
    state.setBookmarks([{ tags: null }, {}, { tags: 'ignored' }, { tags: [' ', ''] }]);
    renderTagCloud();
    expect(els.tagFilterCloud.children).toHaveLength(0);
    expect(els.tagFilterCloud.innerHTML).toBe(
      '<span class="text-xs text-slate-500 italic">尚無標籤</span>',
    );
  });

  it('selects, switches and clears a tag before requesting exactly one render per click', () => {
    const observed = [];
    requestRender.mockImplementation(() => {
      observed.push(state.activeTag);
      renderTagCloud();
    });
    initSidebarActions({ persist: vi.fn(), render: requestRender });
    registerSidebarListeners();
    renderTagCloud();
    els.tagFilterCloud.listeners.click({ target: els.tagFilterCloud.children[0] });
    expect(state.activeTag).toBe('tech');
    expect(requestRender).toHaveBeenCalledTimes(1);
    els.tagFilterCloud.listeners.click({ target: els.tagFilterCloud.children[1] });
    expect(state.activeTag).toBe('fruit');
    expect(requestRender).toHaveBeenCalledTimes(2);
    els.tagFilterCloud.listeners.click({ target: els.tagFilterCloud.children[1] });
    expect(state.activeTag).toBeNull();
    expect(requestRender).toHaveBeenCalledTimes(3);
    expect(observed).toEqual(['tech', 'fruit', null]);
  });
});

describe('renderSidebar', () => {
  it('renders folders before tags without recursively requesting a full render', () => {
    const order = [];
    for (const id of ['folderList', 'tagFilterCloud']) {
      const append = els[id].appendChild;
      els[id].appendChild = function (child) {
        order.push(id);
        append.call(this, child);
      };
    }
    renderSidebar();
    expect(order).toEqual([
      'folderList',
      'folderList',
      'folderList',
      'tagFilterCloud',
      'tagFilterCloud',
      'tagFilterCloud',
    ]);
    expect(requestRender).not.toHaveBeenCalled();
  });

  it.each(ids)('skips missing %s while rendering remaining elements', (id) => {
    delete els[id];
    expect(() => renderSidebar()).not.toThrow();
    if (els.folderList) expect(els.folderList.children).toHaveLength(3);
    if (els.tagFilterCloud) expect(els.tagFilterCloud.children).toHaveLength(3);
    if (els.totalSourceCount) expect(els.totalSourceCount.innerText).toBe('3');
    if (els.allCountBadge) expect(els.allCountBadge.innerText).toBe('3');
  });

  it('safely skips a wholly absent sidebar', () => {
    els = {};
    expect(() => renderSidebar()).not.toThrow();
  });
});
