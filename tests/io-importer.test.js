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
    }))
  ),
  importSqlite: vi.fn(async (bytes, sourceFileId, sourceFileName) => [
    { id: 'sq1', source_file_id: sourceFileId, source_file_name: sourceFileName, bytes: bytes.length },
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
    addEventListener(type, fn) { (this._l[type] = this._l[type] || []).push(fn); },
    removeEventListener(type, fn) {
      this._l[type] = (this._l[type] || []).filter((f) => f !== fn);
    },
    dispatch(type, ev) {
      (this._l[type] || []).forEach((fn) => fn(ev || { stopPropagation() {} }));
    },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    children: [],
    appendChild(c) { this.children.push(c); },
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
});

// helper: run uploads; if the duplicate modal opens, resolve it with `action`
async function uploadResolving(files, action) {
  const pending = handleFileUploads(files);
  await new Promise((r) => setTimeout(r, 0));
  if (el('duplicateModal').classList.contains('hidden') === false) {
    const btn = action === 'overwrite' ? 'dupBtnOverwrite'
      : action === 'keep' ? 'dupBtnKeepBoth' : 'dupBtnCancel';
    el(btn).dispatch('click');
  }
  return pending;
}

// ---- format dispatch ------------------------------------------------------
describe('handleFileUploads — format dispatch', () => {
  it('parses CSV via Papa with monolith options and registers the source file', async () => {
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

    // Simulate Papa's async completion to drive merge + persist.
    config.complete({ data: [{ id: '1', title: 'hello' }] });
    expect(importJsonOrCsv).toHaveBeenCalledWith([{ id: '1', title: 'hello' }], id, 'a.csv');
  });

  it('shows the success toast with the zh-TW message', async () => {
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
      'wrapped.json'
    );
    expect(importJsonOrCsv).toHaveBeenNthCalledWith(
      2,
      [{ id: '2', title: 's' }],
      expect.stringMatching(/^file_/),
      'single.json'
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

    const pending = handleFileUploads([fakeFile('a.csv', 'id,title\n1,hello')]);
    await new Promise((r) => setTimeout(r, 0));
    const [id] = [...sourceFiles.keys()];
    globalThis.Papa.parse.mock.calls[0][1].complete({ data: [{ id: 'dup', title: 'new' }] });
    await pending;

    expect(persist).toHaveBeenCalled();
    const { bookmarks } = await import('../src/core/state.js');
    const dup = bookmarks.filter((b) => b.id === 'dup');
    expect(dup).toHaveLength(1);
    expect(dup[0].title).toBe('new');
    expect(dup[0].source_file_id).toBe(id);
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

