import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  openSaveModal,
  closeSaveModal,
  saveSingleFile,
  exportAllUnifiedJson,
  exportAllUnifiedCsv,
  registerExporterListeners,
} from '../src/io/exporter.js';
import PapaReal from 'papaparse';
import { downloadBlob, saveFileWithFallback } from '../src/utils/download.js';
import { checkImport } from '../src/providers/profiles.js';
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
  const seed = (type, extra = {}) => {
    setSourceFiles(
      new Map([['F1', { id: 'F1', name: `a.${type === 'db' ? 'db' : type}`, type, ...extra }]]),
    );
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

  it('rebuilds the source table in its own recorded layout and downloads a binary blob', async () => {
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
    seed('db', { sqliteSchema: { table: 'articles', columns: ['id', 'title', 'url', 'preview'] } });
    await saveSingleFile('F1');

    // The source's own table and columns — not the app's assumed schema.
    expect(statements[0].sql).toBe(
      'CREATE TABLE "articles" ("id" TEXT, "title" TEXT, "url" TEXT, "preview" TEXT);',
    );
    expect(statements[1].sql).toBe('INSERT INTO "articles" VALUES (?, ?, ?, ?);');
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
    // Every column mapped, so nothing to report.
    expect(el('toastMsg').innerText).toBe('');
  });

  it('carries every column the app knows about, not just four', async () => {
    const statements = [];
    setSQL({
      Database: class {
        run(sql, params) {
          statements.push({ sql, params });
        }
        export() {
          return new Uint8Array([1]);
        }
        close() {}
      },
    });
    // The InstapaperScraper layout: content/tags/reader metadata used to be
    // dropped on the floor by the hardcoded four-column table.
    seed('db', {
      sqliteSchema: {
        table: 'articles',
        columns: ['id', 'title', 'url', 'preview', 'content', 'tags', 'instapaper_url'],
      },
    });
    setBookmarks([
      {
        id: '1',
        source_file_id: 'F1',
        title: 't1',
        url: 'https://a.com',
        article_preview: 'p',
        content: 'full text',
        tags: ['news', 'tech'],
        instapaper_url: 'https://www.instapaper.com/read/1',
      },
    ]);

    await saveSingleFile('F1');

    expect(statements[1].params).toEqual([
      '1',
      't1',
      'https://a.com',
      'p',
      'full text',
      // normalizeTags splits on the comma, so joining on it round-trips exactly.
      'news,tech',
      'https://www.instapaper.com/read/1',
    ]);
  });

  it('refuses to emit a .db whose original layout was never recorded', async () => {
    setSQL({
      Database: class {
        run() {}
      },
    });
    seed('db'); // no sqliteSchema — e.g. a source cached by an older version

    await saveSingleFile('F1');

    // Substituting the app's own schema would hand back a file that only looks
    // like the user's original, so nothing is written at all.
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(el('toastMsg').innerText).toBe(
      '此來源檔案的原始結構未記錄，無法還原 .db；請改用統一 JSON / CSV 匯出',
    );
  });

  it('refuses a recorded layout with no columns instead of emitting invalid DDL', async () => {
    setSQL({
      Database: class {
        run() {
          // What the real engine raises for `CREATE TABLE "articles" ();`
          throw new Error('near ")": syntax error');
        }
        close() {}
      },
    });
    // PRAGMA table_info returns no rows for a name it cannot introspect, so an
    // empty column list is representable. Without the guard this reaches the
    // engine and surfaces a parser error instead of the honest refusal.
    seed('db', { sqliteSchema: { table: 'articles', columns: [] } });

    await saveSingleFile('F1');

    expect(downloadBlob).not.toHaveBeenCalled();
    expect(el('toastMsg').innerText).toBe(
      '此來源檔案的原始結構未記錄，無法還原 .db；請改用統一 JSON / CSV 匯出',
    );
  });

  it('refuses a recorded layout whose table name is missing', async () => {
    const statements = [];
    setSQL({
      Database: class {
        run(sql, params) {
          statements.push({ sql, params });
        }
        export() {
          return new Uint8Array([1]);
        }
        close() {}
      },
    });
    // Only reachable from malformed persisted state (store.js maps a missing
    // field to null, which the `!schema` check already catches), but without
    // this the name is quoted straight into `CREATE TABLE "undefined" (...)`,
    // producing a file that is quietly not the user's own.
    seed('db', { sqliteSchema: { columns: ['id', 'title'] } });

    await saveSingleFile('F1');

    expect(statements).toEqual([]);
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(el('toastMsg').innerText).toBe(
      '此來源檔案的原始結構未記錄，無法還原 .db；請改用統一 JSON / CSV 匯出',
    );
  });

  it('still re-emits a table legitimately named "" rather than refusing it', async () => {
    const statements = [];
    setSQL({
      Database: class {
        run(sql, params) {
          statements.push({ sql, params });
        }
        export() {
          return new Uint8Array([1]);
        }
        close() {}
      },
    });
    // Pins the `typeof` check against a future `!schema.table`: the empty string
    // is a valid SQLite table name, so it must be quoted, not rejected.
    seed('db', { sqliteSchema: { table: '', columns: ['id', 'title'] } });

    await saveSingleFile('F1');

    expect(statements[0].sql).toBe('CREATE TABLE "" ("id" TEXT, "title" TEXT);');
    expect(statements[1].sql).toBe('INSERT INTO "" VALUES (?, ?);');
  });

  it('reports columns it had to write as NULL instead of dropping them silently', async () => {
    const statements = [];
    setSQL({
      Database: class {
        run(sql, params) {
          statements.push({ sql, params });
        }
        export() {
          return new Uint8Array([1]);
        }
        close() {}
      },
    });
    seed('db', {
      sqliteSchema: { table: 'articles', columns: ['id', 'title', 'mystery_column'] },
    });

    await saveSingleFile('F1');

    // The column is still emitted — the file keeps its shape — but the app has
    // no value for it, so the gap is reported rather than passed off as a
    // faithful copy.
    expect(statements[0].sql).toContain('"mystery_column" TEXT');
    expect(statements[1].params).toEqual(['1', 't1', null]);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(el('toastMsg').innerText).toBe('已匯出 a.db，但有 1 個欄位無對應資料，已寫入空白');
  });

  it('escapes a quote in a recorded identifier so it cannot inject DDL', async () => {
    const statements = [];
    setSQL({
      Database: class {
        run(sql, params) {
          statements.push({ sql, params });
        }
        export() {
          return new Uint8Array([1]);
        }
        close() {}
      },
    });
    seed('db', { sqliteSchema: { table: 'we"ird', columns: ['id"x'] } });

    await saveSingleFile('F1');

    expect(statements[0].sql).toBe('CREATE TABLE "we""ird" ("id""x" TEXT);');
    expect(statements[1].sql).toBe('INSERT INTO "we""ird" VALUES (?);');
  });

  it('maps columns case-insensitively so a mixed-case source keeps its values', async () => {
    const statements = [];
    setSQL({
      Database: class {
        run(sql, params) {
          statements.push({ sql, params });
        }
        export() {
          return new Uint8Array([1]);
        }
        close() {}
      },
    });
    // The import path reads columns through lowerKeyed(), so a source declaring
    // `Title` / `URL` imports fine. A case-sensitive lookup here would match
    // nothing and write every column back as NULL while reporting that the app
    // had no data for them.
    seed('db', {
      sqliteSchema: { table: 'Articles', columns: ['ID', 'Title', 'URL', 'Preview'] },
    });

    await saveSingleFile('F1');

    expect(statements[0].sql).toBe(
      'CREATE TABLE "Articles" ("ID" TEXT, "Title" TEXT, "URL" TEXT, "Preview" TEXT);',
    );
    expect(statements[1].params).toEqual(['1', 't1', 'https://a.com', 'p']);
    // Every column resolved, so the "no corresponding data" report stays silent.
    expect(el('toastMsg').innerText).toBe('');
  });

  it('surfaces an export failure from the save button as a toast', async () => {
    setSQL({
      Database: class {
        run() {
          throw new Error('disk full');
        }
        close() {}
      },
    });
    seed('db', { sqliteSchema: { table: 'bookmarks', columns: ['id', 'title'] } });
    registerExporterListeners();

    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Minimal stand-in for the clicked row: the shared element stub has no
    // closest(), and adding one would change behaviour for every other test.
    const target = { closest: () => ({ dataset: { saveFile: 'F1' } }) };
    el('saveSourceFilesList').dispatch('click', { target, stopPropagation() {} });

    // The listener is synchronous and saveSingleFile is not, so let the
    // rejection settle before asserting it was reported rather than dropped.
    await vi.waitFor(() => expect(el('toastMsg').innerText).toBe('檔案匯出失敗，請稍後再試'));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
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
    seed('db', {
      sqliteSchema: { table: 'bookmarks', columns: ['id', 'title', 'url', 'preview'] },
    });

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

describe('CSV formula injection hardening', () => {
  // A malicious import can carry a formula/DDE payload in any field; the export
  // must neutralize it without corrupting the stored data or the other formats.
  it('quotes formula-prefixed fields in a per-source CSV export', async () => {
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv' }]]));
    setBookmarks([
      {
        id: '1',
        title: '=HYPERLINK("http://evil.example","click")',
        url: 'https://a.com',
        article_preview: 'safe preview',
        source_file_id: 'F1',
      },
    ]);

    await saveSingleFile('F1');

    const [rows] = globalThis.Papa.unparse.mock.calls[0];
    expect(rows[0].title).toBe('\'=HYPERLINK("http://evil.example","click")');
    // Inert fields keep their exact original value.
    expect(rows[0].url).toBe('https://a.com');
    expect(rows[0].id).toBe('1');
  });

  it('quotes formula-prefixed tags in the unified CSV export', () => {
    setBookmarks([{ id: '1', title: 'ok', tags: ['=CMD|calc'], source_file_id: 'F1' }]);

    exportAllUnifiedCsv();

    const [rows] = globalThis.Papa.unparse.mock.calls[0];
    expect(rows[0].tags).toBe("'=CMD|calc");
  });

  it('leaves an inert tag list byte-identical so a CSV round-trip stays lossless', () => {
    setBookmarks([{ id: '1', title: 'ok', tags: ['news', '=2+2'], source_file_id: 'F1' }]);

    exportAllUnifiedCsv();

    // The emitted cell is "news,=2+2", which starts with 'n' and is therefore
    // already inert. Prefixing here would turn the tag into "'=2+2" on re-import.
    const [rows] = globalThis.Papa.unparse.mock.calls[0];
    expect(rows[0].tags).toEqual(['news', '=2+2']);
  });

  it('never mutates the in-memory bookmarks', async () => {
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv' }]]));
    const bookmark = { id: '1', title: '=1+1', tags: ['=2+2'], source_file_id: 'F1' };
    setBookmarks([bookmark]);

    await saveSingleFile('F1');
    exportAllUnifiedCsv();

    // A shared-mutation bug here would silently corrupt every later JSON and
    // SQLite export, and would persist into IndexedDB on the next autosave.
    expect(bookmark.title).toBe('=1+1');
    expect(bookmark.tags).toEqual(['=2+2']);
  });

  it('leaves the JSON export unquoted so round-trips stay byte-faithful', async () => {
    setBookmarks([{ id: '1', title: '=1+1', source_file_id: 'F1' }]);

    exportAllUnifiedJson();
    const [blob] = downloadBlob.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    const parsed = JSON.parse(await blob.text());
    expect(parsed.bookmarks[0].title).toBe('=1+1');
  });

  it('leaves the sqlite export unquoted', async () => {
    const inserts = [];
    setSQL({
      Database: class {
        run(sql, p) {
          // Only the INSERT carries bound values; CREATE TABLE passes none.
          if (p) inserts.push(p);
        }
        export() {
          return new Uint8Array([1]);
        }
        close() {}
      },
    });
    setSourceFiles(
      new Map([
        [
          'F1',
          {
            id: 'F1',
            name: 'a.db',
            type: 'db',
            sqliteSchema: { table: 'bookmarks', columns: ['id', 'title', 'url', 'preview'] },
          },
        ],
      ]),
    );
    setBookmarks([
      { id: '1', title: '=1+1', url: 'https://a.com', article_preview: 'p', source_file_id: 'F1' },
    ]);

    await saveSingleFile('F1');

    expect(inserts).toEqual([['1', '=1+1', 'https://a.com', 'p']]);
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

/**
 * Per-source save-back must re-emit the SOURCE's own schema, not the app's
 * internal unified fields — the principle the `.db` path already applies via
 * `sqliteSchema` (emitting the app's schema "would hand back something that
 * merely looks like the original", exporter.js:265).
 *
 * The emitted header list is fed back through the REAL `checkImport`, because
 * that is the observable defect this pins: a re-exported scraper CSV carried
 * `source_file_id` / `detected_language`, so re-importing the user's own file
 * warned 「檔案欄位較符合…統一匯出」. Assertions read the header row back through
 * the real Papa build instead of inspecting objects, so they pin what a
 * spreadsheet and our own importer would actually see.
 */
describe('saveSingleFile — source-aware schema', () => {
  const SCRAPER_COLUMNS = ['id', 'title', 'url', 'preview', 'tags'];

  const seedScraper = (extra = {}) => {
    setSourceFiles(
      new Map([
        [
          'F1',
          {
            id: 'F1',
            name: 'scraper.csv',
            type: 'csv',
            profile: 'instapaper-scraper',
            csvColumns: SCRAPER_COLUMNS,
            ...extra,
          },
        ],
      ]),
    );
    setBookmarks([
      {
        id: '1',
        title: 't1',
        url: 'https://a.com',
        article_preview: 'p',
        content: 'body',
        tags: ['news'],
        detected_language: 'en',
        provider: 'instapaper',
        instapaper_url: 'https://www.instapaper.com/read/1',
        source_file_id: 'F1',
        source_file_name: 'scraper.csv',
      },
      { id: '2', title: 't2', url: 'https://b.com', source_file_id: 'OTHER' },
    ]);
  };

  const emittedCsv = () => {
    const [rows, config] = globalThis.Papa.unparse.mock.calls.at(-1);
    return PapaReal.unparse(rows, config);
  };
  const parseEmitted = () => PapaReal.parse(emittedCsv(), { header: true });
  const emittedHeaders = () => parseEmitted().meta.fields;

  it('re-emits a scraper source under its own columns, so the round trip raises no profile warning', async () => {
    seedScraper();

    await saveSingleFile('F1');

    expect(emittedHeaders()).toEqual(SCRAPER_COLUMNS);
    expect(checkImport('instapaper-scraper', { csvHeaders: emittedHeaders() }).verdict).toBe('ok');
  });

  it('preserves the recorded column order rather than the record key order', async () => {
    seedScraper({ csvColumns: ['url', 'title', 'id'] });

    await saveSingleFile('F1');

    expect(emittedHeaders()).toEqual(['url', 'title', 'id']);
  });

  it('never leaks app-internal fields into a source export', async () => {
    seedScraper({ csvColumns: ['id', 'title', 'url', 'preview', 'content', 'tags'] });

    await saveSingleFile('F1');

    const headers = emittedHeaders();
    for (const internal of [
      'source_file_id',
      'source_file_name',
      'detected_language',
      'deleted_at',
      'provider',
      'instapaper_url',
    ]) {
      expect(headers).not.toContain(internal);
    }
  });
  it('fills the source columns from the matching record fields', async () => {
    seedScraper();

    await saveSingleFile('F1');

    expect(parseEmitted().data).toEqual([
      { id: '1', title: 't1', url: 'https://a.com', preview: 'p', tags: 'news' },
    ]);
  });

  it('emits a column the app cannot fill and reports it rather than dropping it silently', async () => {
    seedScraper({ csvColumns: ['id', 'title', 'starred'] });

    await saveSingleFile('F1');

    // The file keeps its shape — the column is present, just empty.
    expect(emittedHeaders()).toEqual(['id', 'title', 'starred']);
    expect(parseEmitted().data[0].starred).toBe('');
    expect(el('toastMsg').innerText).toContain('1 個欄位無對應資料');
  });

  it('keeps the full internal schema for a unified source', async () => {
    setSourceFiles(
      new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv', profile: 'rll-unified' }]]),
    );
    setBookmarks([
      {
        id: '1',
        title: 't1',
        url: 'https://a.com',
        detected_language: 'en',
        source_file_id: 'F1',
      },
    ]);

    await saveSingleFile('F1');

    // The unified export IS the app's own schema — it must keep round-tripping
    // as rll-unified, otherwise the scraper fix breaks the other profile.
    expect(checkImport('rll-unified', { csvHeaders: emittedHeaders() }).verdict).toBe('ok');
  });

  it('falls back to the unified schema when no columns and no profile are recorded', async () => {
    // A source cached by a version that predates column capture. Guessing a
    // narrower schema here could silently drop fields, so the app keeps the
    // lossless unified shape instead.
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv' }]]));
    setBookmarks([
      { id: '1', title: 't1', url: 'https://a.com', detected_language: 'en', source_file_id: 'F1' },
    ]);

    await saveSingleFile('F1');

    expect(emittedHeaders()).toContain('source_file_id');
    expect(emittedHeaders()).toContain('detected_language');
  });
  it('applies the profile fallback to the json branch as well', async () => {
    setSourceFiles(
      new Map([['F1', { id: 'F1', name: 'a.json', type: 'json', profile: 'instapaper-scraper' }]]),
    );
    setBookmarks([
      {
        id: '1',
        title: 't1',
        url: 'https://a.com',
        article_preview: 'p',
        content: 'body',
        tags: ['news'],
        detected_language: 'en',
        provider: 'instapaper',
        instapaper_url: 'https://www.instapaper.com/read/1',
        source_file_id: 'F1',
        source_file_name: 'a.json',
      },
    ]);

    await saveSingleFile('F1');

    const [json] = saveFileWithFallback.mock.calls[0];
    // `content` is kept: normalizeFields reads it, so omitting it would lose the
    // full article text on re-import.
    expect(Object.keys(JSON.parse(json)[0])).toEqual([
      'id',
      'title',
      'url',
      'article_preview',
      'content',
      'tags',
    ]);
  });

  it('never mutates the in-memory records while projecting them', async () => {
    setSourceFiles(
      new Map([
        [
          'F1',
          {
            id: 'F1',
            name: 'scraper.csv',
            type: 'csv',
            profile: 'instapaper-scraper',
            csvColumns: SCRAPER_COLUMNS,
          },
        ],
      ]),
    );
    const bookmark = { id: '1', title: '=1+1', url: 'https://a.com', source_file_id: 'F1' };
    setBookmarks([bookmark]);

    await saveSingleFile('F1');

    expect(bookmark).toEqual({
      id: '1',
      title: '=1+1',
      url: 'https://a.com',
      source_file_id: 'F1',
    });
  });
});
