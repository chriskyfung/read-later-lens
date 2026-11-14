import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { initImporter, handleFileUploads, applyProfileSelection } from '@/io/import';
import { defaultProfileId } from '@/providers/profiles.js';
import { importJsonOrCsv, importSqlite } from '@/providers';
import { setBookmarks, setSourceFiles, sourceFiles } from '@/core/state';
import { setSQL } from '@/services/sqlEngine.js';
import { resetLayers } from '@/utils/dom/index.js';

const initSql = vi.hoisted(() => vi.fn());
const mockEngine = vi.hoisted(() => ({ Database: class {} }));

// Stands in for the `papaparse` dependency that `src/io/import/` imports.
// These tests assert on the call, so the call is mocked rather than executed.
const Papa = vi.hoisted(() => ({
  parse: vi.fn(),
  unparse: vi.fn(() => 'csv-content'),
}));

vi.mock('papaparse', () => ({ default: Papa }));
vi.mock('@/services/sqlEngine.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    initSql,
    get SQL() {
      return actual.SQL;
    },
    set SQL(v) {
      actual.SQL = v;
    },
  };
});

vi.mock('@/providers/index.js', () => {
  const importJsonOrCsv = vi.fn((rows, sourceFileId, sourceFileName) => ({
    records: rows.map((r, i) => ({
      id: r.id ?? 'n' + i,
      source_file_id: sourceFileId,
      source_file_name: sourceFileName,
      title: r.title ?? '',
    })),
    stats: { droppedNoUrl: 0 },
  }));
  const importSqlite = vi.fn(async (bytes, sourceFileId, sourceFileName) => ({
    records: [
      {
        id: 'sq1',
        source_file_id: sourceFileId,
        source_file_name: sourceFileName,
        bytes: bytes.length,
      },
    ],
    schema: { table: 'bookmarks', columns: ['id', 'title', 'url', 'article_preview', 'tags'] },
    stats: { droppedNoUrl: 0 },
  }));
  return {
    importJsonOrCsv,
    importSqlite,
    // The importer routes through the adapter pair; keep both mock fns
    // shared so existing call assertions keep working.
    resolveImportAdapter: vi.fn(() => ({ importJsonOrCsv, importSqlite })),
  };
});

// ---- DOM stubs -----------------------------------------------------------
const els = {};
function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    value: '',
    style: {},
    inert: false,
    parentElement: null,
    _attrs: {},
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
    setAttribute(name, v) {
      this._attrs[name] = String(v);
    },
    getAttribute(name) {
      return this._attrs[name];
    },
    removeAttribute(name) {
      delete this._attrs[name];
    },
    classList: {
      // Real overlays mount with the Tailwind `hidden` class already applied.
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
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    onclick: null,
    focused: 0,
    focus() {
      this.focused += 1;
    },
    click: vi.fn(),
  };
}

function el(id) {
  if (!els[id]) els[id] = makeEl();
  return els[id];
}

function fakeFile(name, text) {
  return { name, text: async () => text, arrayBuffer: async () => new ArrayBuffer(8) };
}

beforeAll(() => {
  globalThis.window = globalThis.window || {};
  globalThis.document = {
    getElementById: (id) => el(id),
    createElement: () => makeEl(),
  };
});

beforeEach(() => {
  resetLayers();
  for (const k of Object.keys(els)) delete els[k];
  setBookmarks([]);
  setSourceFiles(new Map());
  setSQL(mockEngine);
  initSql.mockReset();
  initSql.mockResolvedValue(mockEngine);
  initImporter({ persistAndRender: vi.fn(), render: vi.fn() });
  applyProfileSelection(defaultProfileId());
  vi.mocked(importJsonOrCsv).mockClear();
  vi.mocked(importSqlite).mockClear();
  initSql.mockClear();
  Papa.parse.mockClear();
  // Default: resolve the import immediately with an empty result. Individual
  // tests override with mockImplementationOnce for specific data/errors.
  Papa.parse.mockImplementation((_text, config) => config.complete({ data: [], errors: [] }));
});

// ---- header sanity check -----------------------------------------------------
describe('handleFileUploads — header sanity check', () => {
  it('blocks the official Instapaper CSV with guidance and registers nothing', async () => {
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [
          {
            URL: 'https://a.example.com',
            Title: 'Article A',
            Selection: '',
            Folder: 'Tech',
            Timestamp: '1738916228',
            Tags: '[]',
          },
        ],
        errors: [],
        meta: { fields: ['URL', 'Title', 'Selection', 'Folder', 'Timestamp', 'Tags'] },
      });
    });

    await handleFileUploads([fakeFile('instapaper-export.csv', 'URL,Title,...')]);

    expect(sourceFiles.size).toBe(0);
    expect(importJsonOrCsv).not.toHaveBeenCalled();
    expect(el('toastMsg').innerText).toContain('Instapaper 官方 CSV');
    expect(el('toastMsg').innerText).toContain('InstapaperScraper');
  });

  it('appends a non-blocking warning when columns disagree with the chosen profile', async () => {
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [{ id: '1', title: 'x', url: 'https://a.example.com', source_file_id: 'F9' }],
        errors: [],
      });
    });

    // Default profile is instapaper-scraper; unified columns => warn, import anyway.
    await handleFileUploads([fakeFile('unified.csv', 'id,title,url,source_file_id')]);

    expect(sourceFiles.size).toBe(1);
    expect(importJsonOrCsv).toHaveBeenCalled();
    expect(el('toastMsg').innerText).toContain('已成功載入檔案: unified.csv');
    expect(el('toastMsg').innerText).toContain('Read Later Lens 統一匯出');
    expect(el('toastMsg').innerText).toContain('仍依所選來源匯入');
  });

  it('stays silent when the columns match the chosen profile', async () => {
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [{ id: '1', title: 'x', url: 'https://a.example.com' }],
        errors: [],
      });
    });

    await handleFileUploads([fakeFile('scraper.csv', 'id,title,url')]);

    expect(el('toastMsg').innerText).toBe('已成功載入檔案: scraper.csv');
  });

  it('blocks the official CSV before the trash/persist machinery runs', async () => {
    const persist = vi.fn();
    initImporter({ persistAndRender: persist });

    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [
          { URL: 'https://a.example.com', Title: 'A', Folder: 'F', Timestamp: '1', Tags: '[]' },
        ],
        errors: [],
      });
    });

    await handleFileUploads([fakeFile('official.csv', 'URL,Title,...')]);

    expect(sourceFiles.size).toBe(0);
    expect(persist).not.toHaveBeenCalled();
  });
});
