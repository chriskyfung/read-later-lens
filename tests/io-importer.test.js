import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { initImporter, handleFileUploads, registerImporterListeners } from '../src/io/importer.js';
import { importJsonOrCsv, importSqlite } from '../src/providers/index.js';
import { setBookmarks, setSourceFiles, setSQL, sourceFiles } from '../src/core/state.js';

vi.mock('../src/providers/index.js', () => ({
  importJsonOrCsv: vi.fn((rows, sourceFileId, sourceFileName) =>
    rows.map((r, i) => ({
      id: r.id ?? 'n' + i,
      source_file_id: sourceFileId,
      source_file_name: sourceFileName,
      title: r.title ?? '',
    })),
  ),
  importSqlite: vi.fn(async (bytes, sourceFileId, sourceFileName) => [
    {
      id: 'sq1',
      source_file_id: sourceFileId,
      source_file_name: sourceFileName,
      bytes: bytes.length,
    },
  ]),
  providerForExtension: vi.fn(() => 'instapaper'),
}));

// ---- DOM stubs -----------------------------------------------------------
const els = {};
function makeEl() {
  return {
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
    },
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    onclick: null,
  };
}
function el(id) {
  if (!els[id]) els[id] = makeEl();
  return els[id];
}

function fakeFile(name, text) {
  return { name, text: async () => text, arrayBuffer: async () => new ArrayBuffer(8) };
}

const fakeEngine = { Database: class {} };

beforeAll(() => {
  globalThis.window = globalThis.window || {};
  globalThis.document = {
    getElementById: (id) => el(id),
    createElement: () => makeEl(),
  };
  globalThis.Papa = {
    parse: vi.fn(),
    unparse: vi.fn(() => 'csv-content'),
  };
});

beforeEach(() => {
  for (const k of Object.keys(els)) delete els[k];
  setBookmarks([]);
  setSourceFiles(new Map());
  setSQL(fakeEngine);
  initImporter({ persistAndRender: vi.fn(), deleteFolder: vi.fn() });
  vi.mocked(importJsonOrCsv).mockClear();
  vi.mocked(importSqlite).mockClear();
  globalThis.Papa.parse.mockClear();
  // Default: resolve the import immediately with an empty result. Individual
  // tests override with mockImplementationOnce for specific data/errors.
  globalThis.Papa.parse.mockImplementation((_text, config) =>
    config.complete({ data: [], errors: [] }),
  );
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

// ---- format dispatch ------------------------------------------------------
describe('handleFileUploads — format dispatch', () => {
  it('parses CSV via Papa with monolith options and registers the source file', async () => {
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: '1', title: 'hello' }], errors: [] });
    });
    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,hello')]);

    expect(globalThis.Papa.parse).toHaveBeenCalledTimes(1);
    const [text, config] = globalThis.Papa.parse.mock.calls[0];
    expect(text).toBe('id,title\n1,hello');
    expect(config.header).toBe(true);
    expect(config.skipEmptyLines).toBe(true);

    const [id] = [...sourceFiles.keys()];
    expect(id).toMatch(/^file_\d+_[0-9a-z]{5}$/);
    const rec = sourceFiles.get(id);
    expect(rec.name).toBe('a.csv');
    expect(rec.type).toBe('csv');
    expect(rec.originalData).toBe('id,title\n1,hello');

    // The awaited Papa completion drove the merge + persist synchronously.
    expect(importJsonOrCsv).toHaveBeenCalledWith([{ id: '1', title: 'hello' }], id, 'a.csv');
  });

  it('shows the success toast with the zh-TW message', async () => {
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: '1', title: 'hello' }], errors: [] });
    });
    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,hello')]);
    expect(el('toastMsg').innerText).toBe('已成功載入檔案: a.csv');
  });

  it('accepts a plain JSON array', async () => {
    await handleFileUploads([fakeFile('a.json', JSON.stringify([{ id: '1', title: 'x' }]))]);

    const [id] = [...sourceFiles.keys()];
    expect(sourceFiles.get(id).type).toBe('json');
    expect(importJsonOrCsv).toHaveBeenCalledWith([{ id: '1', title: 'x' }], id, 'a.json');
  });

  it('unwraps the { bookmarks: [...] } JSON shape and falls back to [object]', async () => {
    await handleFileUploads([
      fakeFile('wrapped.json', JSON.stringify({ bookmarks: [{ id: '1', title: 'w' }] })),
      fakeFile('single.json', JSON.stringify({ id: '2', title: 's' })),
    ]);

    expect(importJsonOrCsv).toHaveBeenNthCalledWith(
      1,
      [{ id: '1', title: 'w' }],
      expect.stringMatching(/^file_/),
      'wrapped.json',
    );
    expect(importJsonOrCsv).toHaveBeenNthCalledWith(
      2,
      [{ id: '2', title: 's' }],
      expect.stringMatching(/^file_/),
      'single.json',
    );
  });

  it('routes .db files through importSqlite with a Uint8Array and the SQL engine', async () => {
    const { SQL: engine } = await import('../src/core/state.js');
    await handleFileUploads([fakeFile('instapaper.db', 'binary')]);

    expect(importSqlite).toHaveBeenCalledTimes(1);
    const [bytes, id, name, usedEngine] = importSqlite.mock.calls[0];
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(id).toMatch(/^file_\d+_[0-9a-z]{5}$/);
    expect(name).toBe('instapaper.db');
    expect(usedEngine).toBe(engine);
    expect([...sourceFiles.values()][0].type).toBe('db');
  });

  it('shows the failure toast for invalid JSON and registers nothing', async () => {
    await handleFileUploads([fakeFile('bad.json', '{not json')]);

    expect(sourceFiles.size).toBe(0);
    expect(el('toastMsg').innerText).toBe('解析檔案 bad.json 失敗，請確認格式');
  });

  it('merges records and calls persistAndRender (incoming wins on id)', async () => {
    const persist = vi.fn();
    initImporter({ persistAndRender: persist });
    setBookmarks([{ id: 'dup', title: 'old', source_file_id: 'old-file' }]);

    // Drive Papa's completion synchronously, the way a real string parse does.
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: 'dup', title: 'new' }], errors: [] });
    });

    const pending = handleFileUploads([fakeFile('a.csv', 'id,title\n1,hello')]);
    await new Promise((r) => setTimeout(r, 0));
    const [id] = [...sourceFiles.keys()];
    await pending;

    expect(persist).toHaveBeenCalled();
    const { bookmarks } = await import('../src/core/state.js');
    const dup = bookmarks.filter((b) => b.id === 'dup');
    expect(dup).toHaveLength(1);
    expect(dup[0].title).toBe('new');
    expect(dup[0].source_file_id).toBe(id);
  });
  it('says so when a re-import replaces trashed records', async () => {
    const persist = vi.fn();
    initImporter({ persistAndRender: persist });
    setBookmarks([{ id: 'dup', title: 'deleted copy', deleted_at: '2026-01-01T00:00:00.000Z' }]);
    // Drive Papa's completion synchronously, the way a real string parse does
    // (the callback fires inside parse, before the success toast is composed).
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: 'dup', title: 'fresh' }] });
    });

    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,hello')]);

    // The trash entry is discarded in favour of the freshly imported record
    // (mergeBookmarks is incoming-wins), so the toast flags the displacement.
    expect(el('toastMsg').innerText).toBe(
      '已成功載入檔案: a.csv（1 筆已存在於回收桶的書籤已被新匯入資料取代）',
    );
    const { bookmarks } = await import('../src/core/state.js');
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].title).toBe('fresh');
    expect(bookmarks[0].deleted_at).toBeUndefined();
  });

  it('keeps the plain success toast when the import displaces nothing', async () => {
    setBookmarks([{ id: 'dup', title: 'deleted copy', deleted_at: '2026-01-01T00:00:00.000Z' }]);
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: 'other', title: 'new' }] });
    });

    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,hello')]);

    expect(el('toastMsg').innerText).toBe('已成功載入檔案: a.csv');
    const { bookmarks } = await import('../src/core/state.js');
    expect(bookmarks).toHaveLength(2);
  });
});

// ---- failure semantics and toast coverage ---------------------------------
describe('handleFileUploads — failure semantics (Option A)', () => {
  it('rejects unsupported extensions with an error toast and registers nothing', async () => {
    await handleFileUploads([fakeFile('notes.txt', 'just some text')]);

    expect(sourceFiles.size).toBe(0);
    expect(el('toastMsg').innerText).toBe(
      '不支援的檔案格式「.txt」，請上傳 CSV、JSON 或 SQLite 檔案',
    );
  });

  it('fails the whole CSV when Papa yields no usable rows but errors', async () => {
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [], errors: [{ code: 'UndetectableDelimiter' }] });
    });
    await handleFileUploads([fakeFile('broken.csv', 'not,a,parseable,file')]);

    expect(sourceFiles.size).toBe(0);
    expect(el('toastMsg').innerText).toBe('解析檔案 broken.csv 失敗，請確認格式');
  });

  it('reports partially parseable CSVs with a skipped-row summary and keeps the source', async () => {
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [{ id: '1', title: 'ok' }],
        errors: [{ row: 1, message: 'Too few fields' }],
      });
    });
    await handleFileUploads([fakeFile('partial.csv', 'id,title\n1,ok')]);

    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe(
      '已載入檔案: partial.csv（1 筆書籤，1 列解析失敗已略過）',
    );
  });

  it('warns (and keeps the source) when a valid file contains zero bookmarks', async () => {
    // Default Papa mock completes with { data: [], errors: [] }.
    await handleFileUploads([fakeFile('empty.csv', 'id,title\n')]);

    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe('已載入檔案: empty.csv，但未偵測到任何書籤');
  });

  it("surfaces Papa's error callback through the shared failure toast", async () => {
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
      config.error(new Error('papa exploded'));
    });
    await handleFileUploads([fakeFile('boom.csv', 'id,title\n1,hello')]);

    expect(sourceFiles.size).toBe(0);
    expect(el('toastMsg').innerText).toBe('解析檔案 boom.csv 失敗，請確認格式');
  });
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
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
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

// ---- duplicate name resolution --------------------------------------------
describe('handleFileUploads — duplicate name resolution', () => {
  const seedDuplicate = () => {
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv', originalData: '' }]]));
    setBookmarks([{ id: '1', source_file_id: 'F1', title: 'old' }]);
  };

  it('overwrite: deletes the old source silently and re-imports under the same name', async () => {
    seedDuplicate();
    const deleteFolder = vi.fn();
    initImporter({ deleteFolder });

    await uploadResolving([fakeFile('a.csv', 'id,title\n1,hello')], 'overwrite');

    expect(el('duplicateFileText').innerText).toContain('已存在名為「a.csv」的檔案');
    expect(deleteFolder).toHaveBeenCalledWith('F1', false);
    const names = [...sourceFiles.values()].map((f) => f.name);
    expect(names).toContain('a.csv');
  });

  it('keep: imports under a timestamped name and keeps the original', async () => {
    seedDuplicate();
    const deleteFolder = vi.fn();
    initImporter({ deleteFolder });

    await uploadResolving([fakeFile('a.csv', 'id,title\n1,hello')], 'keep');

    expect(deleteFolder).not.toHaveBeenCalled();
    const names = [...sourceFiles.values()].map((f) => f.name);
    expect(names.filter((n) => n !== 'a.csv')[0]).toMatch(/a_\d{13}\.csv$/);
    expect(names.filter((n) => n === 'a.csv')).toHaveLength(1); // original kept
  });

  it('cancel: imports nothing and deletes nothing', async () => {
    seedDuplicate();
    const deleteFolder = vi.fn();
    initImporter({ deleteFolder });

    await uploadResolving([fakeFile('a.csv', 'id,title\n1,hello')], 'cancel');

    expect(deleteFolder).not.toHaveBeenCalled();
    expect(sourceFiles.size).toBe(1); // only the seeded duplicate remains
    expect(el('duplicateModal').classList.contains('hidden')).toBe(true);
  });
});

// ---- listener registration -------------------------------------------------
describe('registerImporterListeners', () => {
  it('wires #fileInput change events to handleFileUploads', async () => {
    registerImporterListeners();
    const input = el('fileInput');

    input.dispatch('change', { target: { files: [fakeFile('z.csv', 'id,title\n1,hi')] } });
    await new Promise((r) => setTimeout(r, 0));

    expect(globalThis.Papa.parse).toHaveBeenCalledTimes(1);
  });

  it('no-ops when #fileInput is missing', () => {
    const spy = vi.spyOn(globalThis.document, 'getElementById').mockReturnValue(null);
    expect(() => registerImporterListeners()).not.toThrow();
    spy.mockRestore();
  });
});
