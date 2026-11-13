import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  initImporter,
  handleFileUploads,
  createUniqueSourceName,
  applyProfileSelection,
} from '@/io/import';
import { defaultProfileId } from '@/providers/profiles.js';
import { importJsonOrCsv, importSqlite } from '@/providers';
import { bookmarks, setBookmarks, setSourceFiles, sourceFiles } from '@/core/state';
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

// helper: run uploads; if the duplicate modal opens, resolve it with `action`
async function uploadResolving(files, action) {
  const pending = handleFileUploads(files);
  await new Promise((r) => setTimeout(r, 0));
  if (el('duplicateModal').classList.contains('hidden') === false) {
    const btn =
      action === 'overwrite'
        ? 'dupBtnOverwrite'
        : action === 'keep'
          ? 'dupBtnKeepBoth'
          : 'dupBtnCancel';
    el(btn).dispatch('click');
  }
  return pending;
}

// ---- duplicate name resolution --------------------------------------------
describe('handleFileUploads — duplicate name resolution', () => {
  const seedDuplicate = () => {
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv', originalData: '' }]]));
    setBookmarks([{ id: '1', source_file_id: 'F1', title: 'old' }]);
  };

  it('overwrite: replaces the old source and its bookmarks in a single transaction', async () => {
    seedDuplicate();
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: '1', title: 'hello' }], errors: [] });
    });

    await uploadResolving([fakeFile('a.csv', 'id,title\n1,hello')], 'overwrite');

    expect(el('duplicateFileText').innerText).toContain('已存在名為「a.csv」的檔案');
    expect(sourceFiles.has('F1')).toBe(false);
    const [newId] = [...sourceFiles.keys()];
    expect(newId).toMatch(/^file_/);
    expect(sourceFiles.get(newId).name).toBe('a.csv');
    expect(bookmarks.filter((b) => b.source_file_id === 'F1')).toHaveLength(0);
    expect(bookmarks.filter((b) => b.source_file_id === newId)).toHaveLength(1);
  });

  it('overwrite: keeps the old source intact when the replacement fails parsing', async () => {
    seedDuplicate();
    setBookmarks([
      { id: '1', source_file_id: 'F1', title: 'old-active' },
      { id: '2', source_file_id: 'F1', title: 'old-trash', deleted_at: '2026-01-01T00:00:00.000Z' },
    ]);
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [], errors: [{ code: 'UndetectableDelimiter' }] });
    });

    await uploadResolving([fakeFile('a.csv', '{broken csv')], 'overwrite');

    expect(sourceFiles.has('F1')).toBe(true);
    expect(sourceFiles.get('F1').name).toBe('a.csv');
    expect(bookmarks.map((b) => b.id)).toEqual(['1', '2']);
    expect(el('toastMsg').innerText).toBe('解析檔案 a.csv 失敗，請確認格式');
  });

  it('overwrite: preserves the old source and shows a toast when replacement yields zero valid bookmarks', async () => {
    seedDuplicate();
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [], errors: [] });
    });

    await uploadResolving([fakeFile('a.csv', 'id,title\n')], 'overwrite');

    expect(sourceFiles.has('F1')).toBe(true);
    expect(sourceFiles.get('F1').name).toBe('a.csv');
    expect(bookmarks.map((b) => b.id)).toEqual(['1']);
    expect(el('toastMsg').innerText).toBe('新檔案未匯入任何有效書籤，已保留原來源檔案');
  });

  it('overwrite: restores the old source if cache write fails at the boundary', async () => {
    seedDuplicate();
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: '1', title: 'hello' }], errors: [] });
    });
    initImporter({ persistAndRender: vi.fn(async () => ({ persisted: false, rendered: true })) });

    await uploadResolving([fakeFile('a.csv', 'id,title\n1,hello')], 'overwrite');

    expect(sourceFiles.has('F1')).toBe(true);
    expect(sourceFiles.get('F1').name).toBe('a.csv');
    expect(bookmarks.map((b) => b.id)).toEqual(['1']);
    expect(el('toastMsg').innerText).toContain('已還原匯入 a.csv：無法寫入本機快取');
  });

  it('keep: imports under a unique timestamped name and keeps the original', async () => {
    seedDuplicate();

    await uploadResolving([fakeFile('a.csv', 'id,title\n1,hello')], 'keep');

    const names = [...sourceFiles.values()].map((f) => f.name);
    expect(names.filter((n) => n !== 'a.csv')[0]).toMatch(/a_\d{13}\.csv$/);
    expect(names.filter((n) => n === 'a.csv')).toHaveLength(1); // original kept
    expect(sourceFiles.has('F1')).toBe(true);
    expect(bookmarks.filter((b) => b.source_file_id === 'F1').map((b) => b.id)).toEqual(['1']);
  });

  it('createUniqueSourceName: adds a suffix to extension-less names', () => {
    expect(createUniqueSourceName('README', ['README'])).toMatch(/^README_\d{13}$/);
  });

  it('createUniqueSourceName: disambiguates same-millisecond collisions', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1735680000000);
    try {
      const first = createUniqueSourceName('a.csv', ['a.csv']);
      const second = createUniqueSourceName('a.csv', ['a.csv', first]);

      expect(first).toBe('a_1735680000000.csv');
      expect(second).toBe('a_1735680000000_1.csv');
    } finally {
      now.mockRestore();
    }
  });

  it('keep: skips a generated name that already exists', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1735680000000);
    try {
      setSourceFiles(
        new Map([
          ['F1', { id: 'F1', name: 'a.csv', type: 'csv', originalData: '' }],
          ['F2', { id: 'F2', name: 'a_1735680000000.csv', type: 'csv', originalData: '' }],
        ]),
      );

      await uploadResolving([fakeFile('a.csv', 'id,title\n1,hello')], 'keep');

      expect([...sourceFiles.values()].map((f) => f.name)).toContain('a_1735680000000_1.csv');
    } finally {
      now.mockRestore();
    }
  });

  it('cancel: imports nothing and deletes nothing', async () => {
    seedDuplicate();

    await uploadResolving([fakeFile('a.csv', 'id,title\n1,hello')], 'cancel');

    expect(sourceFiles.size).toBe(1); // only the seeded duplicate remains
    expect(bookmarks.filter((b) => b.source_file_id === 'F1').map((b) => b.id)).toEqual(['1']);
    expect(el('duplicateModal').classList.contains('hidden')).toBe(true);
  });
});
