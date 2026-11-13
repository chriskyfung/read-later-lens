import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { initImporter, handleFileUploads, applyProfileSelection } from '@/io/import';
import { defaultProfileId } from '@/providers/profiles.js';
import { importJsonOrCsv, importSqlite } from '@/providers';
import { setBookmarks, setSourceFiles, sourceFiles } from '@/core/state';
import { setSQL } from '@/services/sqlEngine.js';
import { resetLayers } from '@/utils/dom/index.js';
import { STALE_STATE_REASON } from '@/core/guard.js';

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

// ---- transaction boundary ---------------------------------------------------
describe('processSingleFile — transaction boundary', () => {
  const csvFile = () => fakeFile('a.csv', 'id,title\n1,x');
  const completeWith = (data) =>
    Papa.parse.mockImplementationOnce((_text, config) => config.complete({ data, errors: [] }));

  it('commits the merge once persist reports the state is saved', async () => {
    initImporter({ persistAndRender: vi.fn(async () => ({ persisted: true, rendered: true })) });
    completeWith([{ id: '1', title: 'x' }]);

    await handleFileUploads([csvFile()]);

    const { bookmarks } = await import('@/core/state');
    expect(bookmarks.map((b) => b.title)).toEqual(['x']);
    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe('已成功載入檔案: a.csv');
  });

  it('rolls both halves of the unit back when the write failed', async () => {
    const render = vi.fn();
    initImporter({
      persistAndRender: vi.fn(async () => ({ persisted: false, rendered: true })),
      render,
    });
    setBookmarks([{ id: 'keep', title: 'kept', source_file_id: 'F0' }]);
    completeWith([{ id: '1', title: 'x' }]);

    await handleFileUploads([csvFile()]);

    const { bookmarks } = await import('@/core/state');
    // Neither half survives: no imported records and no ghost folder.
    expect(bookmarks.map((b) => b.title)).toEqual(['kept']);
    expect(sourceFiles.size).toBe(0);
    expect(render).toHaveBeenCalledTimes(1);
    expect(el('toastMsg').innerText).toBe('已還原匯入 a.csv：無法寫入本機快取，資料不會保留');
  });

  it('names the cross-tab conflict instead of a generic cache failure', async () => {
    initImporter({
      persistAndRender: vi.fn(async () => ({ persisted: false, conflict: true, rendered: true })),
    });
    setBookmarks([{ id: 'keep', title: 'kept', source_file_id: 'F0' }]);
    completeWith([{ id: '1', title: 'x' }]);

    await handleFileUploads([csvFile()]);

    const { bookmarks } = await import('@/core/state');
    // Same rollback as any failed write: the overtaken tab keeps what it had.
    expect(bookmarks.map((b) => b.title)).toEqual(['kept']);
    expect(sourceFiles.size).toBe(0);
    // The difference is what the user is told: the write was not slow, it lost.
    // The short reason is the guard's shared string, so assert against it
    // directly rather than a frozen copy that could silently drift.
    expect(el('toastMsg').innerText).toBe(
      `已還原匯入 a.csv：${STALE_STATE_REASON}，資料不會保留，請重新載入後再試`,
    );
  });

  it('undoes a merge that a failing write left behind (orphan regression)', async () => {
    initImporter({
      persistAndRender: () => {
        throw new Error('cache exploded');
      },
    });
    completeWith([{ id: '1', title: 'x' }]);

    await handleFileUploads([csvFile()]);

    const { bookmarks } = await import('@/core/state');
    // Without the rollback the merge stayed in memory while the catch deleted
    // the source record — a bookmark pointing at a source_file_id that no
    // longer exists, invisible in the folder list.
    expect(bookmarks).toEqual([]);
    expect(sourceFiles.size).toBe(0);
    expect(el('toastMsg').innerText).toBe('解析檔案 a.csv 失敗，請確認格式');
  });

  it('treats a fire-and-forget persist stub as committed (legacy contract)', async () => {
    initImporter({ persistAndRender: () => {} });
    completeWith([{ id: '1', title: 'x' }]);

    await handleFileUploads([csvFile()]);

    const { bookmarks } = await import('@/core/state');
    expect(bookmarks.map((b) => b.title)).toEqual(['x']);
    expect(sourceFiles.size).toBe(1);
  });

  it('reports each file its own trash displacement', async () => {
    const gates = [];
    initImporter({
      persistAndRender: () =>
        new Promise((resolve) => gates.push(() => resolve({ persisted: true, rendered: true }))),
    });
    setBookmarks([{ id: 'dup', title: 'deleted copy', deleted_at: '2026-01-01T00:00:00.000Z' }]);
    completeWith([{ id: 'dup', title: 'fresh' }]);
    completeWith([{ id: 'other', title: 'new' }]);

    // Two imports in flight: only the first displaces a trashed record, and it
    // is the one that finishes last. With the old shared module counter the
    // second file's reset left the first file's toast reporting 0.
    const first = handleFileUploads([csvFile()]);
    const second = handleFileUploads([fakeFile('b.csv', 'id,title\n1,y')]);
    await vi.waitFor(() => expect(gates).toHaveLength(2));

    gates[1]();
    await second;
    expect(el('toastMsg').innerText).toBe('已成功載入檔案: b.csv');

    gates[0]();
    await first;
    expect(el('toastMsg').innerText).toContain('已被新匯入資料取代');
  });
});
