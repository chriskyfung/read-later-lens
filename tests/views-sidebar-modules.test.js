/**
 * @fileoverview Tests for the split sidebar modules (src/views/sidebar/*).
 *
 * The pre-split behavior is pinned by tests/views-sidebar.test.js, which
 * imports the facades and is left unchanged — it is the no-regression proof.
 * These tests cover the modules the split introduced: the pure projections,
 * the id constants and the render path's single-pass folder counting.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SIDEBAR_IDS,
  SIDEBAR_DATA_ATTRS,
  FOLDER_ALL,
  FOLDER_TRASH,
} from '../src/views/sidebar/constants.js';
import {
  partitionBookmarks,
  countActiveByFolder,
  collectTagCounts,
  getActiveSidebarBookmarks,
} from '../src/views/sidebar/service.js';
import { renderSidebarFolders, applyTrashFallback } from '../src/views/sidebar/folders.js';
import * as state from '../src/core/state.js';

function makeEl() {
  const el = {
    querySelector(selector) {
      this.elements ||= {};
      return (this.elements[selector] ||= makeEl());
    },
    innerText: '',
    dataset: {},
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    closest() {
      return this;
    },
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
  const parts = () => el.className.split(/\s+/).filter(Boolean);
  el.classList = {
    add(...names) {
      el.className = [...new Set([...parts(), ...names])].join(' ');
    },
    remove(...names) {
      const hide = new Set(names);
      el.className = parts()
        .filter((c) => !hide.has(c))
        .join(' ');
    },
    toggle(name, force) {
      const target = force === undefined ? !parts().includes(name) : force;
      if (target) el.classList.add(name);
      else el.classList.remove(name);
      return target;
    },
    contains(name) {
      return parts().includes(name);
    },
  };
  return el;
}

let els;

beforeEach(() => {
  state.setBookmarks([]);
  state.setSourceFiles(new Map());
  state.setActiveFolder(FOLDER_ALL);
  state.setActiveTag(null);
  els = Object.fromEntries(Object.values(SIDEBAR_IDS).map((id) => [id, makeEl()]));
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {
    getElementById: (id) => els[id] || null,
    createElement: () => makeEl(),
  });
});

afterEach(() => {
  state.setBookmarks([]);
  state.setSourceFiles(new Map());
  state.setActiveFolder(FOLDER_ALL);
  state.setActiveTag(null);
  vi.unstubAllGlobals();
});

describe('SIDEBAR_IDS', () => {
  it('names every sidebar element the markup renders', () => {
    expect(SIDEBAR_IDS).toEqual({
      folderList: 'folderList',
      allFolderBtn: 'allFolderBtn',
      totalSourceCount: 'totalSourceCount',
      allCountBadge: 'allCountBadge',
      trashFolderBtn: 'trashFolderBtn',
      trashCountBadge: 'trashCountBadge',
      tagFilterCloud: 'tagFilterCloud',
      languageFilters: 'languageFilters',
      storageUsageText: 'storageUsageText',
      storageProgressBar: 'storageProgressBar',
    });
  });

  it('agrees with the ids rendered by the sidebar markup sections', async () => {
    const sections = await Promise.all([
      import('../src/components/sidebar/sections/folders.js'),
      import('../src/components/sidebar/sections/languageFilters.js'),
      import('../src/components/sidebar/sections/tags.js'),
      import('../src/components/sidebar/sections/storage.js'),
    ]);
    const markup = sections.map((m) => Object.values(m)[0]()).join('\n');
    Object.values(SIDEBAR_IDS).forEach((id) => {
      expect(markup).toContain(`id="${id}"`);
    });
  });
});

describe('partitionBookmarks', () => {
  it('splits the population into active and trashed', () => {
    const list = [
      { id: '1' },
      { id: '2', deleted_at: '2026-01-01' },
      { id: '3', deleted_at: null },
    ];
    const { activeList, active, trashed } = partitionBookmarks(list);
    expect(activeList.map((b) => b.id)).toEqual(['1', '3']);
    expect(active).toBe(2);
    expect(trashed).toBe(1);
  });
});

describe('countActiveByFolder', () => {
  it('counts the active bookmarks per source file', () => {
    const list = [{ source_file_id: 'f1' }, { source_file_id: 'f1' }, { source_file_id: 'f2' }];
    expect(countActiveByFolder(list).get('f1')).toBe(2);
    expect(countActiveByFolder(list).get('f2')).toBe(1);
    expect(countActiveByFolder(list).get('f3')).toBeUndefined();
  });
});

describe('collectTagCounts', () => {
  it('counts every bookmark, trashed ones included', () => {
    const list = [
      { tags: ['a', 'b'] },
      { tags: ['a'], deleted_at: '2026-01-01' },
      { tags: null },
      { tags: 'not-an-array' },
      { tags: ['  ', ''] },
    ];
    const counts = collectTagCounts(list);
    expect(counts.get('a')).toBe(2);
    expect(counts.get('b')).toBe(1);
    expect(counts.size).toBe(2);
  });

  it('keeps the first-seen order', () => {
    const counts = collectTagCounts([{ tags: ['z', 'a'] }, { tags: ['m'] }]);
    expect([...counts.keys()]).toEqual(['z', 'a', 'm']);
  });
});

describe('getActiveSidebarBookmarks', () => {
  it('excludes trashed bookmarks', () => {
    state.setBookmarks([{ id: '1' }, { id: '2', deleted_at: '2026-01-01' }]);
    expect(getActiveSidebarBookmarks().map((b) => b.id)).toEqual(['1']);
  });
});

describe('applyTrashFallback', () => {
  it('resets the active folder to ALL only for an empty trash', () => {
    state.setActiveFolder(FOLDER_TRASH);
    expect(applyTrashFallback(FOLDER_TRASH, 0)).toBe(true);
    expect(state.activeFolder).toBe(FOLDER_ALL);

    state.setActiveFolder(FOLDER_TRASH);
    expect(applyTrashFallback(FOLDER_TRASH, 3)).toBe(false);
    expect(state.activeFolder).toBe(FOLDER_TRASH);
  });
});

describe('renderSidebarFolders', () => {
  it("reads each active bookmark's source_file_id exactly once", () => {
    state.setSourceFiles(
      new Map([
        ['f1', { id: 'f1', name: 'A.csv', type: 'csv' }],
        ['f2', { id: 'f2', name: 'B.csv', type: 'csv' }],
        ['f3', { id: 'f3', name: 'C.csv', type: 'csv' }],
      ]),
    );
    let reads = 0;
    const bookmark = {
      id: '1',
      get source_file_id() {
        reads += 1;
        return 'f1';
      },
    };
    state.setBookmarks([bookmark]);

    renderSidebarFolders();

    // One pass over the active list — not one pass per source file.
    expect(reads).toBe(1);
    expect(els.allCountBadge.innerText).toBe('1');
  });

  it('renders the folder rows in source-file order with their counts', () => {
    state.setSourceFiles(
      new Map([
        ['f1', { id: 'f1', name: 'A.csv', type: 'csv' }],
        ['f2', { id: 'f2', name: 'B.csv', type: 'csv' }],
      ]),
    );
    state.setBookmarks([{ id: '1', source_file_id: 'f1' }]);

    renderSidebarFolders();

    const rows = els.folderList.children;
    expect(rows).toHaveLength(2);
    expect(rows[0].dataset.selectFolder).toBe('f1');
    expect(rows[1].dataset.selectFolder).toBe('f2');
    expect(rows[0].innerHTML).toContain('>1</span>');
    expect(rows[1].innerHTML).toContain('>0</span>');
  });

  it('keeps the trash row hidden when the trash is empty', () => {
    state.setActiveFolder(FOLDER_TRASH);
    renderSidebarFolders();
    expect(els.trashFolderBtn.classList.contains('hidden')).toBe(true);
    expect(state.activeFolder).toBe(FOLDER_ALL);
    expect(els.allFolderBtn.className).toContain('active');
  });

  it('shows the trash row when the trash has entries', () => {
    state.setBookmarks([{ id: '1', source_file_id: 'f1', deleted_at: '2026-01-01' }]);
    renderSidebarFolders();
    expect(els.trashFolderBtn.classList.contains('hidden')).toBe(false);
    expect(els.trashCountBadge.innerText).toBe('1');
    expect(els.allCountBadge.innerText).toBe('0');
  });

  it('removes only the generated rows, keeping the static rows', () => {
    state.setSourceFiles(new Map([['f1', { id: 'f1', name: 'A.csv', type: 'csv' }]]));
    renderSidebarFolders();
    renderSidebarFolders();
    expect(els.folderList.children).toHaveLength(1);
  });
});

describe('SIDEBAR_DATA_ATTRS', () => {
  it('matches the attributes the markup and the listeners use', () => {
    expect(SIDEBAR_DATA_ATTRS).toEqual({
      selectFolder: 'data-select-folder',
      deleteFolder: 'data-delete-folder',
      filterTag: 'data-filter-tag',
    });
  });
});
