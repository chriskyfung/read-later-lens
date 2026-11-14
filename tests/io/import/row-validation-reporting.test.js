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

// ---- validation (URL-less rows dropped by the adapter) ----------------------
describe('handleFileUploads — row validation reporting', () => {
  it('reports URL-less rows the adapter dropped and keeps the source', async () => {
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [
          { id: '1', title: 'ok', url: 'https://a.example.com' },
          { id: '2', title: 'no url' },
          { id: '3', title: 'also no url' },
        ],
        errors: [],
      });
    });
    // The real adapter drops URL-less rows and reports its own count; simulate
    // its output here so the summary proves it reports that count, not a
    // length delta the importer infers.
    vi.mocked(importJsonOrCsv).mockImplementationOnce((rows) => ({
      records: rows.filter((r) => r.url).map((r) => ({ id: r.id, title: r.title })),
      stats: { droppedNoUrl: 2 },
    }));

    await handleFileUploads([
      fakeFile('mixed.csv', 'id,title,url\n1,x,https://a.example.com\n2,y\n3,z'),
    ]);

    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe('已載入檔案: mixed.csv（1 筆書籤，2 筆缺少網址已略過）');
  });

  it('combines parse failures and dropped rows in one summary', async () => {
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [
          { id: '1', title: 'ok', url: 'https://a.example.com' },
          { id: '2', title: 'no url' },
        ],
        errors: [{ row: 5, message: 'Too few fields' }],
      });
    });
    vi.mocked(importJsonOrCsv).mockImplementationOnce((rows) => ({
      records: rows.filter((r) => r.url).map((r) => ({ id: r.id, title: r.title })),
      stats: { droppedNoUrl: 1 },
    }));

    await handleFileUploads([fakeFile('both.csv', 'id,title,url\n1,x,https://a.example.com\n2,y')]);

    expect(el('toastMsg').innerText).toBe(
      '已載入檔案: both.csv（1 筆書籤，1 列解析失敗、1 筆缺少網址已略過）',
    );
  });

  it('reports an all-invalid file with zero imported bookmarks', async () => {
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [
          { id: '1', title: 'a' },
          { id: '2', title: 'b' },
        ],
        errors: [],
      });
    });
    // An all-URL-less file reports the adapter's count verbatim, not the
    // largest number a length delta can describe.
    vi.mocked(importJsonOrCsv).mockImplementationOnce(() => ({
      records: [],
      stats: { droppedNoUrl: 2 },
    }));

    await handleFileUploads([fakeFile('nourl.csv', 'id,title\n1,a\n2,b')]);

    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe('已載入檔案: nourl.csv（0 筆書籤，2 筆缺少網址已略過）');
  });

  it('does not report 缺少網址 when the adapter drops rows for another reason', async () => {
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [
          { id: '1', title: 'kept', url: 'https://a.example.com' },
          { id: '2', title: 'deduped duplicate' },
          { id: '3', title: 'rejected row' },
        ],
        errors: [],
      });
    });
    // A length delta would see 3 rows -> 1 record and mislabel the other two
    // as URL-less. The adapter reports its own zero count, so no reason is
    // claimed instead of the wrong one.
    vi.mocked(importJsonOrCsv).mockImplementationOnce(() => ({
      records: [{ id: '1', title: 'kept' }],
      stats: { droppedNoUrl: 0 },
    }));

    await handleFileUploads([
      fakeFile('dedup.csv', 'id,title,url\n1,x,https://a.example.com\n2,y\n3,z'),
    ]);

    expect(el('toastMsg').innerText).toBe('已成功載入檔案: dedup.csv');
  });

  it('reports the URL-less rows the SQLite adapter drops, like every other format', async () => {
    // SQLite previously reported nothing at all: its drops were the only ones
    // the summary never saw. The same content now gets the same feedback.
    vi.mocked(importSqlite).mockImplementationOnce(async () => ({
      records: [{ id: 'sq1', title: 'kept' }],
      schema: { table: 'bookmarks', columns: ['id', 'title', 'url'] },
      stats: { droppedNoUrl: 2 },
    }));

    await handleFileUploads([fakeFile('export.db', 'binary')]);

    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe('已載入檔案: export.db（1 筆書籤，2 筆缺少網址已略過）');
  });
});
