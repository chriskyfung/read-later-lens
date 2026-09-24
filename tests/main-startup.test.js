// Regression coverage replacing the former global-bridge contract tests.
describe('entry-point feature wiring', () => {
  it('persists and renders uploads through the registered input listener', async () => {
    await start();
    const { saveState } = await import('../src/core/store.js');
    els.fileInput.dispatch('change', {
      target: {
        files: [
          {
            name: 'test.json',
            text: async () => JSON.stringify([bookmark('1', 'Apple', 'https://apple.com')]),
          },
        ],
      },
    });
    await vi.waitFor(() => expect(els.filteredCount.innerText).toBe(1));
    expect(saveState).toHaveBeenCalledTimes(1);
    // The modal was never opened here, so closing defensively must not throw.
    expect(els.importModal.classList.contains('hidden')).toBe(true);
  });

  it('rolls the import back when the cache write fails (e2e)', async () => {
    const store = await import('../src/core/store.js');
    const { saveState } = store;
    const { showToast } = await import('../src/utils/dom.js');
    // A write can fail outright (rejected promise): the import must be undone
    // rather than announced as a success that a reload would not reproduce.
    store.saveState.mockRejectedValueOnce(new Error('QuotaExceededError'));

    await start();
    els.fileInput.dispatch('change', {
      target: {
        files: [
          {
            name: 'nocache.json',
            text: async () =>
              JSON.stringify([bookmark('n1', 'Nectarine', 'https://nectarine.com')]),
          },
        ],
      },
    });

    await vi.waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('無法寫入本機快取')),
    );
    // The transaction boundary: nothing from the failed import survives, so the
    // session can never disagree with what the next reload will show. This must
    // hold for both module state and the rendered view — persistAndRender()
    // renders the merged state before it discovers the write failure.
    const state = await import('../src/core/state.js');
    expect(state.bookmarks).toHaveLength(0);
    expect(state.sourceFiles.size).toBe(0);
    expect(els.filteredCount.innerText).toBe(0);
    expect(saveState).toHaveBeenCalledTimes(1);
  });

  it('imports through the source picker modal opened from the header (e2e)', async () => {
    await start();
    const { stackDepth } = await import('../src/utils/dom.js');

    els.importBtn.dispatch('click');
    expect(stackDepth()).toBe(1);
    expect(els.importModal.getAttribute('aria-hidden')).toBe('false');

    // Choose the unified profile, then confirm the file selection.
    els['importProfile-rll-unified'].dispatch('click');
    els.fileInput.dispatch('change', {
      target: {
        files: [
          {
            name: 'unified.json',
            text: async () => JSON.stringify([bookmark('u1', 'Grape', 'https://grape.com')]),
          },
        ],
      },
    });

    await vi.waitFor(() => expect(els.filteredCount.innerText).toBe(1));
    // Parsing starts only after the picker modal closed — no stacking.
    expect(stackDepth()).toBe(0);
    expect(els.importModal.classList.contains('hidden')).toBe(true);

    const state = await import('../src/core/state.js');
    const [source] = [...state.sourceFiles.values()];
    expect(source.profile).toBe('rll-unified');
  });

  it('deletes bookmarks through nested clicks after repeated renders', async () => {
    await start();
    const state = await import('../src/core/state.js');
    const { renderAll } = await import('../src/views/main-view.js');
    const { saveState } = await import('../src/core/store.js');
    const id = `bookmark'"id`;
    state.setBookmarks([bookmark(id, 'Apple', 'https://apple.com')]);
    state.selectedIds.add(id);
    renderAll();
    renderAll();
    const card = els.bookmarkCardsGrid.children[0];
    const button = card.querySelector('[data-delete-bookmark]');
    expect(button.dataset.deleteBookmark).toBe(id);
    expect(card.innerHTML).not.toContain(id);
    els.bookmarkCardsGrid.dispatch('click', {
      target: { closest: (selector) => (selector === '[data-delete-bookmark]' ? button : null) },
    });
    // Soft delete: the record stays in state (with a stamp) for the trash view,
    // but leaves the grid and the selection.
    expect(state.bookmarks).toHaveLength(1);
    expect(state.bookmarks[0].deleted_at).toBeTruthy();
    expect(state.bookmarks.filter((b) => !b.deleted_at)).toHaveLength(0);
    expect(state.selectedIds.size).toBe(0);
    expect(saveState).toHaveBeenCalledTimes(1);
    expect(els.bookmarkCardsGrid.listeners.click).toHaveLength(1);
  });

  it('keeps a trashed bookmark recoverable and ignores a repeated delete click', async () => {
    await start();
    const state = await import('../src/core/state.js');
    const { renderAll } = await import('../src/views/main-view.js');
    const { saveState } = await import('../src/core/store.js');
    const id = `keep"bookmark`;
    state.setBookmarks([bookmark(id, 'Apple', 'https://apple.com')]);
    renderAll();
    const card = els.bookmarkCardsGrid.children[0];
    const button = card.querySelector('[data-delete-bookmark]');
    els.bookmarkCardsGrid.dispatch('click', {
      target: { closest: (selector) => (selector === '[data-delete-bookmark]' ? button : null) },
    });
    expect(state.bookmarks).toHaveLength(1);
    expect(state.bookmarks[0].id).toBe(id);
    expect(state.bookmarks[0].deleted_at).toBeTruthy();
    expect(saveState).toHaveBeenCalledTimes(1);

    // Clicking the (now stale) card button again must not touch the record: it
    // is already in the trash, so there is nothing left to soft delete.
    els.bookmarkCardsGrid.dispatch('click', {
      target: { closest: (selector) => (selector === '[data-delete-bookmark]' ? button : null) },
    });
    expect(saveState).toHaveBeenCalledTimes(1);
    expect(state.bookmarks).toHaveLength(1);
  });

  it('trashes the open bookmark from the reader modal (e2e)', async () => {
    await start();
    const state = await import('../src/core/state.js');
    const { saveState } = await import('../src/core/store.js');
    const { openReaderModal } = await import('../src/views/readerModal.js');
    state.setBookmarks([bookmark('r1', 'Apple', 'https://apple.com')]);

    openReaderModal('r1');
    expect(els.readerModal.classList.contains('hidden')).toBe(false);
    els.readerDeleteBtn.dispatch('click');

    expect(state.bookmarks).toHaveLength(1);
    expect(state.bookmarks[0].deleted_at).toBeTruthy();
    expect(els.readerModal.classList.contains('hidden')).toBe(true);
    expect(saveState).toHaveBeenCalled();
  });

  it('closes the reader modal with Escape (e2e)', async () => {
    await start();
    const state = await import('../src/core/state.js');
    const { openReaderModal } = await import('../src/views/readerModal.js');
    state.setBookmarks([bookmark('r1', 'Apple', 'https://apple.com')]);

    // The stub markup does not carry the Tailwind `hidden` class, so mark the
    // other overlays closed the way the real mount does.
    els.similarityModal.classList.add('hidden');
    els.saveModal.classList.add('hidden');

    openReaderModal('r1');
    expect(els.readerModal.classList.contains('hidden')).toBe(false);

    const event = { key: 'Escape', preventDefault: vi.fn() };
    document.dispatch('keydown', event);

    expect(els.readerModal.classList.contains('hidden')).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('keeps folder deletion separate from selection and handles nested clicks', async () => {
    await start();
    const state = await import('../src/core/state.js');
    const { renderAll } = await import('../src/views/main-view.js');
    const { saveState } = await import('../src/core/store.js');
    const id = `folder'"id`;
    state.setSourceFiles(new Map([[id, { id, name: 'test.json', type: 'json' }]]));
    state.setBookmarks([{ ...bookmark('1', 'Apple', 'https://apple.com'), source_file_id: id }]);
    renderAll();
    renderAll();
    let row = els.folderList.children[0];
    expect(row.dataset.selectFolder).toBe(id);
    expect(row.innerHTML).not.toContain(id);
    els.folderList.dispatch('click', {
      target: { closest: (selector) => (selector === '[data-select-folder]' ? row : null) },
    });
    expect(state.activeFolder).toBe(id);
    row = els.folderList.children[0];
    const button = row.querySelector('[data-delete-folder]');
    expect(button.dataset.deleteFolder).toBe(id);
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const event = {
      stopPropagation: vi.fn(),
      target: { closest: (selector) => (selector === '[data-delete-folder]' ? button : row) },
    };
    els.folderList.dispatch('click', event);
    expect(state.sourceFiles.has(id)).toBe(true);
    confirm.mockReturnValue(true);
    els.folderList.dispatch('click', event);
    expect(state.sourceFiles.size).toBe(0);
    expect(state.activeFolder).toBe('ALL');
    expect(state.bookmarks).toEqual([]);
    expect(saveState).toHaveBeenCalledTimes(1);
    expect(els.folderList.listeners.click).toHaveLength(1);
  });

  it('exports a source through a nested click after reopening the save modal', async () => {
    await start();
    const state = await import('../src/core/state.js');
    const { saveFileWithFallback } = await import('../src/utils/download.js');
    const id = `source'"id`;
    state.setSourceFiles(new Map([[id, { id, name: 'test.json', type: 'json' }]]));
    state.setBookmarks([{ ...bookmark('1', 'Apple', 'https://apple.com'), source_file_id: id }]);
    els.saveBackBtn.dispatch('click');
    els.saveBackBtn.dispatch('click');
    const row = els.saveSourceFilesList.children[0];
    const button = row.querySelector('[data-save-file]');
    expect(button.dataset.saveFile).toBe(id);
    expect(row.innerHTML).not.toContain(id);
    els.saveSourceFilesList.dispatch('click', { target: { closest: () => button } });
    await vi.waitFor(() => expect(saveFileWithFallback).toHaveBeenCalledTimes(1));
    expect(saveFileWithFallback).toHaveBeenCalledWith(
      JSON.stringify(state.bookmarks, null, 2),
      'test.json',
      'application/json',
    );
    expect(els.saveSourceFilesList.listeners.click).toHaveLength(1);
  });

  it.each([
    ['wordcloud', 'wordCloudContainer'],
    ['domains', 'domainChartContainer'],
  ])('wires %s clicks opened through tab navigation', async (tab, container) => {
    await start();
    const state = await import('../src/core/state.js');
    state.setBookmarks([
      bookmark('1', 'Apple orchard', 'https://apple.com'),
      bookmark('2', 'Banana garden', 'https://banana.com'),
    ]);
    Object.values(els)
      .find((el) => el.dataset.tab === tab)
      .dispatch('click');
    expect(state.activeTab).toBe(tab);
    els[container].children[0].onclick();
    expect(state.activeTab).toBe('bookmarks');
    expect(state.searchQuery).not.toBe('');
    expect(els.filteredCount.innerText).toBe(1);
  });
});

it('loads one module entry without a global bridge or inline action handlers', () => {
  const root = new URL('../', import.meta.url);
  const html = readFileSync(new URL('index.html', root), 'utf8');
  expect(html.match(/<script type="module" src="\/src\/main.js"><\/script>/g)).toHaveLength(1);
  expect(html).not.toMatch(/DOMContentLoaded|window\.IBM|function renderAll/);
  function checkSources(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) checkSources(url);
      else if (entry.name.endsWith('.js')) {
        expect(readFileSync(url, 'utf8'), url.pathname).not.toMatch(
          /window\.IBM|onclick\s*=\s*["']/,
        );
      }
    }
  }
  checkSources(new URL('src/', root));
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

vi.mock('../src/utils/download.js', () => ({
  downloadBlob: vi.fn(),
  saveFileWithFallback: vi.fn(async () => {}),
}));

vi.mock('../src/core/store.js', () => ({
  loadState: vi.fn(async () => false),
  saveState: vi.fn(async () => {}),
  getStorageUsage: vi.fn(async () => ({ usageKB: 2, limitMB: 50 })),
}));
vi.mock('../src/utils/dom.js', async (importOriginal) => ({
  ...(await importOriginal()),
  showToast: vi.fn(),
}));

let els;
let mounts;
function makeEl() {
  const classes = new Set();
  const selectors = new Map();
  return {
    innerText: '',
    value: '',
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
    dataset: {},
    children: [],
    className: '',
    listeners: {},
    _html: '',
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        const on = force === undefined ? !classes.has(name) : Boolean(force);
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
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
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
    },
    remove() {
      this.parent.children = this.parent.children.filter((c) => c !== this);
    },
    querySelectorAll(selector) {
      return this.children.filter((child) =>
        child.className.split(' ').includes(selector.slice(1)),
      );
    },
    querySelector(selector) {
      if (!selectors.has(selector)) selectors.set(selector, makeEl());
      return selectors.get(selector);
    },
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      this.listeners[type] = (this.listeners[type] || []).filter((cb) => cb !== fn);
    },
    dispatch(type, event = {}) {
      (this.listeners[type] || []).forEach((fn) => fn(event));
    },
    insertAdjacentHTML(_position, html) {
      mounts.push(html);
      // Only mounted IDs exist: registration before mounting will fail the test.
      for (const match of html.matchAll(/id="([^"]+)"/g)) els[match[1]] = makeEl();
      for (const match of html.matchAll(/data-tab="([^"]+)"/g)) {
        const tab = makeEl();
        tab.dataset.tab = match[1];
        els[`tab${match[1]}`] = tab;
      }
    },
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  // The header is a sibling of #appBody; both go inert while a modal is open.
  els = { appBody: makeEl(), appHeader: makeEl() };
  mounts = [];
  vi.stubGlobal('window', { initSqlJs: vi.fn(async () => ({})) });
  vi.stubGlobal('document', {
    body: makeEl(),
    getElementById: (id) => els[id] || null,
    createElement: () => makeEl(),
    _doc: {},
    addEventListener(type, fn) {
      (this._doc[type] = this._doc[type] || []).push(fn);
    },
    dispatch(type, ev) {
      (this._doc[type] || []).forEach((fn) => fn(ev));
    },
    querySelectorAll: (selector) =>
      Object.entries(els)
        .filter(([id, el]) =>
          selector === '.main-tab' ? Boolean(el.dataset.tab) : /^panel[A-Z]/.test(id),
        )
        .map(([, el]) => el),
  });
  const store = await import('../src/core/store.js');
  store.loadState.mockReset().mockResolvedValue(false);
  store.getStorageUsage.mockReset().mockResolvedValue({ usageKB: 2, limitMB: 50 });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function start() {
  const entry = await import('../src/main.js');
  await entry.ready;
  return entry;
}

const bookmark = (id, title, url) => ({
  id,
  title,
  url,
  tags: [],
  detected_language: 'en',
  source_file_name: 'test.json',
});

describe('module-owned startup', () => {
  it('mounts, wires listeners and renders empty state once without publishing globals', async () => {
    const entry = await start();
    expect(mounts).toHaveLength(4);
    expect(els.filteredCount.innerText).toBe(0);
    expect(els.storageUsageText.innerText).toBe('2 KB / 50 MB');
    expect(window.IBM).toBeUndefined();
    for (const [id, type] of [
      ['fileInput', 'change'],
      ['importBtn', 'click'],
      ['searchInput', 'input'],
      ['saveBackBtn', 'click'],
      ['bookmarkCardsGrid', 'click'],
      ['folderList', 'click'],
      ['tagFilterCloud', 'click'],
      ['trashList', 'click'],
      ['emptyTrashBtn', 'click'],
    ])
      expect(els[id].listeners[type]).toHaveLength(1);
    expect(await start()).toBe(entry);
    expect(mounts).toHaveLength(4);
    expect(els.fileInput.listeners.change).toHaveLength(1);
  });

  it('mounts every element the export wiring contract expects', async () => {
    await start();
    const { EXPORT_LISTENERS } = await import('../src/io/exporter.js');
    const mountedIds = new Set(
      mounts.flatMap((html) => [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1])),
    );

    // Guard against a vacuous pass if the mount capture ever changes shape.
    expect(mountedIds.size).toBeGreaterThan(0);

    // src/io/exporter.js is resilient to missing markup (dom.on warns and
    // skips), so this test is what keeps a renamed/relocated modal id loud:
    // it fails in CI instead of silently disabling an export button in prod.
    for (const [id] of EXPORT_LISTENERS) {
      expect(mountedIds.has(id), `#${id} is wired by src/io/exporter.js but never mounted`).toBe(
        true,
      );
    }
  });

  it('restores bookmarks before the first render and reports restoration', async () => {
    const state = await import('../src/core/state.js');
    const { loadState } = await import('../src/core/store.js');
    const { showToast } = await import('../src/utils/dom.js');
    loadState.mockImplementation(async () => {
      state.setBookmarks([bookmark('1', 'Apple', 'https://apple.com')]);
      return true;
    });
    await start();
    expect(els.filteredCount.innerText).toBe(1);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('1 筆書籤'));
  });

  it.each(['loadState', 'getStorageUsage'])('still renders when %s fails', async (method) => {
    const store = await import('../src/core/store.js');
    store[method].mockRejectedValue(new Error('unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await start();
    expect(log).toHaveBeenCalledTimes(1);
    expect(store.getStorageUsage).toHaveBeenCalledTimes(1);
    expect(els.filteredCount.innerText).toBe(0);
  });
});
