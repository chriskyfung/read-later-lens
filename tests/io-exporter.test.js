import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  openSaveModal,
  closeSaveModal,
  saveSingleFile,
  exportAllUnifiedJson,
  exportAllUnifiedCsv,
  registerExporterListeners,
} from '../src/io/exporter.js';
import { downloadBlob, saveFileWithFallback } from '../src/utils/download.js';
import { setBookmarks, setSourceFiles, setSQL } from '../src/core/state.js';
import { resetLayers } from '../src/utils/dom.js';

vi.mock('../src/utils/download.js', () => ({
  downloadBlob: vi.fn(),
  saveFileWithFallback: vi.fn(async () => {}),
}));

// ---- DOM stubs -----------------------------------------------------------
const els = {};
const created = [];
function makeEl() {
  return {
    dataset: {},
    querySelector(selector) {
      this.elements ||= {};
      return (this.elements[selector] ||= makeEl());
    },
    innerText: '',
    innerHTML: '',
    className: '',
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
      _s: new Set(),
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
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    onclick: null,
    focused: 0,
    focus() {
      this.focused += 1;
    },
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
    createElement: () => {
      const e = makeEl();
      created.push(e);
      return e;
    },
  };
  globalThis.Papa = {
    parse: vi.fn(),
    unparse: vi.fn(() => 'csv-content'),
  };
});

beforeEach(() => {
  resetLayers();
  for (const k of Object.keys(els)) delete els[k];
  globalThis.document.activeElement = null;
  created.length = 0;
  setBookmarks([]);
  setSourceFiles(new Map());
  setSQL(null);
  vi.mocked(downloadBlob).mockClear();
  vi.mocked(saveFileWithFallback).mockClear();
  globalThis.Papa.unparse.mockClear();
});
// END-PART1

describe('openSaveModal', () => {
  it('shows the empty-state hint when no source files are loaded', () => {
    openSaveModal();
    expect(el('saveSourceFilesList').innerHTML).toContain('尚無載入的來源檔案');
    expect(el('saveModal').classList.contains('hidden')).toBe(false);
  });

  it('renders one row per source file with the data-save-file attribute', () => {
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv' }]]));

    openSaveModal();

    const rows = created.filter((e) => e.className.includes('p-3'));
    expect(rows).toHaveLength(1);
    expect(rows[0].innerHTML).toContain('a.csv');
    expect(rows[0].innerHTML).toContain('csv 格式');
    expect(rows[0].querySelector('[data-save-file]').dataset.saveFile).toBe('F1');
    expect(el('saveModal').classList.contains('hidden')).toBe(false);
  });
});

describe('saveSingleFile', () => {
  const seed = (type) => {
    setSourceFiles(new Map([['F1', { id: 'F1', name: `a.${type === 'db' ? 'db' : type}`, type }]]));
    setBookmarks([
      { id: '1', title: 't1', url: 'https://a.com', article_preview: 'p', source_file_id: 'F1' },
      { id: '2', title: 't2', url: 'https://b.com', article_preview: 'q', source_file_id: 'OTHER' },
    ]);
  };

  it("unparses only the file's bookmarks for csv", async () => {
    seed('csv');
    await saveSingleFile('F1');
    expect(globalThis.Papa.unparse).toHaveBeenCalledWith([
      expect.objectContaining({ id: '1', source_file_id: 'F1' }),
    ]);
    expect(saveFileWithFallback).toHaveBeenCalledWith('csv-content', 'a.csv', 'text/csv');
  });

  it('pretty-prints json with the json mime type', async () => {
    seed('json');
    await saveSingleFile('F1');
    const [json] = saveFileWithFallback.mock.calls[0];
    expect(JSON.parse(json)).toEqual([expect.objectContaining({ id: '1' })]);
    expect(saveFileWithFallback).toHaveBeenCalledWith(json, 'a.json', 'application/json');
  });

  it('rebuilds the monolith sqlite schema and downloads a binary blob', async () => {
    const statements = [];
    const lifecycle = [];
    setSQL({
      Database: class {
        run(sql, params) {
          statements.push({ sql, params });
        }
        export() {
          lifecycle.push('export');
          return new Uint8Array([1, 2, 3]);
        }
        close() {
          lifecycle.push('close');
        }
      },
    });
    seed('db');
    await saveSingleFile('F1');

    expect(statements[0].sql).toBe(
      'CREATE TABLE bookmarks (id TEXT, title TEXT, url TEXT, article_preview TEXT);',
    );
    expect(statements[1].params).toEqual(['1', 't1', 'https://a.com', 'p']);
    expect(statements).toHaveLength(2);

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, filename] = downloadBlob.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/octet-stream');
    expect(blob.size).toBe(3);
    expect(filename).toBe('a.db');

    // Released exactly once, and only after export() copied the bytes out.
    expect(lifecycle).toEqual(['export', 'close']);
  });

  it('releases the sqlite database when the table build throws', async () => {
    let closes = 0;
    setSQL({
      Database: class {
        run() {
          throw new Error('disk full');
        }
        close() {
          closes += 1;
        }
      },
    });
    seed('db');

    await expect(saveSingleFile('F1')).rejects.toThrow('disk full');
    expect(closes).toBe(1);
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('no-ops for unknown ids', async () => {
    await saveSingleFile('missing');
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(saveFileWithFallback).not.toHaveBeenCalled();
  });

  it("excludes trashed bookmarks from the file's rows", async () => {
    seed('csv');
    setBookmarks([
      { id: '1', title: 't1', url: 'https://a.com', article_preview: 'p', source_file_id: 'F1' },
      {
        id: '3',
        title: 'trashed',
        url: 'https://c.com',
        article_preview: 'r',
        source_file_id: 'F1',
        deleted_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await saveSingleFile('F1');

    expect(globalThis.Papa.unparse).toHaveBeenCalledWith([expect.objectContaining({ id: '1' })]);
  });
});
// END-PART2

describe('unified exports', () => {
  beforeEach(() => {
    setBookmarks([
      { id: '1', title: 't1', source_file_id: 'F1' },
      { id: '2', title: 't2', source_file_id: 'F2' },
    ]);
  });

  it('exports all bookmarks as a versioned unified JSON envelope', async () => {
    exportAllUnifiedJson();
    const [blob, filename] = downloadBlob.mock.calls[0];
    expect(filename).toBe('all_bookmarks_export.json');
    expect(blob.type).toBe('application/json');
    const parsed = JSON.parse(await blob.text());
    expect(parsed.format).toBe('read-later-lens');
    expect(parsed.version).toBe(1);
    expect(parsed.bookmarks.map((b) => b.id)).toEqual(['1', '2']);
  });

  it('unparses all bookmarks as all_bookmarks_export.csv', () => {
    exportAllUnifiedCsv();
    expect(globalThis.Papa.unparse).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: '1' })]),
    );
    const [blob, filename] = downloadBlob.mock.calls[0];
    expect(filename).toBe('all_bookmarks_export.csv');
    expect(blob.type).toBe('text/csv');
  });

  it('keeps trashed bookmarks out of both unified exports', async () => {
    setBookmarks([
      { id: '1', title: 't1', source_file_id: 'F1' },
      { id: '9', title: 'trashed', source_file_id: 'F1', deleted_at: '2026-01-01T00:00:00.000Z' },
    ]);

    exportAllUnifiedJson();
    const [blob] = downloadBlob.mock.calls[0];
    expect(JSON.parse(await blob.text()).bookmarks.map((b) => b.id)).toEqual(['1']);

    exportAllUnifiedCsv();
    const [csvRows] = globalThis.Papa.unparse.mock.calls.at(-1);
    expect(csvRows.map((b) => b.id)).toEqual(['1']);
  });
});

describe('registerExporterListeners', () => {
  it('wires the save/back, close and unified export buttons', () => {
    registerExporterListeners();

    el('saveBackBtn').dispatch('click');
    expect(el('saveModal').classList.contains('hidden')).toBe(false);
    expect(el('saveSourceFilesList').innerHTML).toContain('尚無載入的來源檔案');

    el('closeSaveBtn').dispatch('click');
    expect(el('saveModal').classList.contains('hidden')).toBe(true);

    el('exportAllUnifiedJsonBtn').dispatch('click');
    el('exportAllUnifiedCsvBtn').dispatch('click');
    expect(downloadBlob).toHaveBeenCalledTimes(2);
    expect(downloadBlob.mock.calls[0][1]).toBe('all_bookmarks_export.json');
    expect(downloadBlob.mock.calls[1][1]).toBe('all_bookmarks_export.csv');
  });

  it('keeps wiring the remaining controls when one export button is missing', () => {
    const original = globalThis.document.getElementById;
    globalThis.document.getElementById = (id) =>
      id === 'exportAllUnifiedJsonBtn' ? null : original(id);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Regression guard (Issue 1.6): an unguarded getElementById().addEventListener
    // threw here, aborting the rest of the wiring AND the remainder of boot.
    expect(() => registerExporterListeners()).not.toThrow();

    // The sibling bindings stay live …
    el('exportAllUnifiedCsvBtn').dispatch('click');
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(downloadBlob.mock.calls[0][1]).toBe('all_bookmarks_export.csv');

    el('saveBackBtn').dispatch('click');
    expect(el('saveModal').classList.contains('hidden')).toBe(false);
    el('closeSaveBtn').dispatch('click');
    expect(el('saveModal').classList.contains('hidden')).toBe(true);

    // … and the gap is reported rather than silently swallowed.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('#exportAllUnifiedJsonBtn'));

    globalThis.document.getElementById = original;
    warn.mockRestore();
  });
});

describe('closeSaveModal', () => {
  it('hides the modal and restores focus to the opener', () => {
    const opener = makeEl();
    globalThis.document.activeElement = opener;
    const modal = el('saveModal');
    modal.focused = 0;

    openSaveModal();
    expect(modal.focused).toBe(1);

    closeSaveModal();
    expect(modal.classList.contains('hidden')).toBe(true);
    expect(opener.focused).toBe(1);
  });

  it('no-ops when the save modal is missing', () => {
    const original = globalThis.document.getElementById;
    globalThis.document.getElementById = (id) => (id === 'saveModal' ? null : el(id));
    expect(() => closeSaveModal()).not.toThrow();
    globalThis.document.getElementById = original;
  });
});
