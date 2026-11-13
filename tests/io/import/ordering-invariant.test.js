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

// ---- ordering invariant ------------------------------------------------------
describe('processSingleFile — ordering invariant', () => {
  it('has the source record registered before persistAndRender fires (synchronous persist)', async () => {
    const seen = [];
    initImporter({
      persistAndRender: () => {
        seen.push(sourceFiles.size);
      },
    });
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: '1', title: 'x' }], errors: [] });
    });

    await handleFileUploads([fakeFile('sync.csv', 'id,title\n1,x')]);

    // A synchronous persist stub — the pathological case the monolith tripped
    // over — must still observe the fully registered sourceFiles map.
    expect(seen).toEqual([1]);
  });

  it('removes the source record again when the import fails mid-flight', async () => {
    initImporter({
      persistAndRender: () => {
        // Even if persist ran before the failure, the catch must clean up.
      },
    });
    await handleFileUploads([fakeFile('bad.json', '{not json')]);

    expect(sourceFiles.size).toBe(0);
  });
});
