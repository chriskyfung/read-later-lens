import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  initImporter,
  handleFileUploads,
  createUniqueSourceName,
  registerImporterListeners,
  applyProfileSelection,
} from '../src/io/importer.js';
import { defaultProfileId } from '../src/providers/profiles.js';
import { importJsonOrCsv, importSqlite } from '../src/providers/index.js';
import { bookmarks, setBookmarks, setSourceFiles, setSQL, sourceFiles } from '../src/core/state.js';
import { resetLayers, stackDepth } from '../src/utils/dom.js';

const initSql = vi.hoisted(() => vi.fn());
const mockEngine = vi.hoisted(() => ({ Database: class {} }));

vi.mock('../src/io/sqlLoader.js', () => ({ initSql }));

vi.mock('../src/providers/index.js', () => {
  const importJsonOrCsv = vi.fn((rows, sourceFileId, sourceFileName) =>
    rows.map((r, i) => ({
      id: r.id ?? 'n' + i,
      source_file_id: sourceFileId,
      source_file_name: sourceFileName,
      title: r.title ?? '',
    })),
  );
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
  globalThis.Papa = {
    parse: vi.fn(),
    unparse: vi.fn(() => 'csv-content'),
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

  it('does not initialize SQL.js for CSV or JSON imports', async () => {
    await handleFileUploads([
      fakeFile('a.csv', 'id,title\n1,hello'),
      fakeFile('a.json', JSON.stringify([{ id: '2', title: 'world' }])),
    ]);

    expect(initSql).not.toHaveBeenCalled();
    expect(sourceFiles.size).toBe(2);
  });

  it('routes .db files through importSqlite with a Uint8Array and the SQL engine', async () => {
    const { SQL: engine } = await import('../src/core/state.js');
    await handleFileUploads([fakeFile('instapaper.db', 'binary')]);

    expect(initSql).toHaveBeenCalledTimes(1);
    expect(importSqlite).toHaveBeenCalledTimes(1);
    const [bytes, id, name, usedEngine] = importSqlite.mock.calls[0];
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(id).toMatch(/^file_\d+_[0-9a-z]{5}$/);
    expect(name).toBe('instapaper.db');
    expect(usedEngine).toBe(engine);
    expect([...sourceFiles.values()][0].type).toBe('db');
  });

  it('stamps the observed SQLite schema onto the source record', async () => {
    // The raw buffer is memory-only, so this recorded layout is the only
    // surviving description of the file's original shape.
    await handleFileUploads([fakeFile('instapaper.db', 'binary')]);

    const [file] = [...sourceFiles.values()];
    expect(file.sqliteSchema).toEqual({
      table: 'bookmarks',
      columns: ['id', 'title', 'url', 'article_preview', 'tags'],
    });
  });

  it('leaves sqliteSchema unset for non-SQL sources', async () => {
    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,t')]);

    const [file] = [...sourceFiles.values()];
    expect(file.sqliteSchema).toBeUndefined();
  });

  it('stamps the observed CSV header row onto the source record', async () => {
    // The header row is the only surviving description of the file's own column
    // layout, so save-back re-emits it instead of the app's internal schema.
    globalThis.Papa.parse.mockImplementationOnce((_text, config) =>
      config.complete({
        data: [{ id: '1', title: 't', url: 'https://a.com' }],
        errors: [],
        meta: { fields: ['id', 'title', 'url', 'preview'] },
      }),
    );

    await handleFileUploads([fakeFile('a.csv', 'id,title,url,preview\n1,t,https://a.com,p')]);

    const [file] = [...sourceFiles.values()];
    expect(file.csvColumns).toEqual(['id', 'title', 'url', 'preview']);
  });

  it('records no header row when Papa reports none, instead of guessing one', async () => {
    // The default parse mock returns no `meta`, matching an unparseable-header
    // file. Guessing a layout here is what the `.db` path refuses to do.
    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,t')]);

    const [file] = [...sourceFiles.values()];
    expect(file.csvColumns).toBeNull();
  });

  it('records no header row for non-CSV sources', async () => {
    await handleFileUploads([fakeFile('a.json', '[]')]);

    const [file] = [...sourceFiles.values()];
    expect(file.csvColumns).toBeUndefined();
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

// ---- transaction boundary ---------------------------------------------------
describe('processSingleFile — transaction boundary', () => {
  const csvFile = () => fakeFile('a.csv', 'id,title\n1,x');
  const completeWith = (data) =>
    globalThis.Papa.parse.mockImplementationOnce((_text, config) =>
      config.complete({ data, errors: [] }),
    );

  it('commits the merge once persist reports the state is saved', async () => {
    initImporter({ persistAndRender: vi.fn(async () => ({ persisted: true, rendered: true })) });
    completeWith([{ id: '1', title: 'x' }]);

    await handleFileUploads([csvFile()]);

    const { bookmarks } = await import('../src/core/state.js');
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

    const { bookmarks } = await import('../src/core/state.js');
    // Neither half survives: no imported records and no ghost folder.
    expect(bookmarks.map((b) => b.title)).toEqual(['kept']);
    expect(sourceFiles.size).toBe(0);
    expect(render).toHaveBeenCalledTimes(1);
    expect(el('toastMsg').innerText).toBe('已還原匯入 a.csv：無法寫入本機快取，資料不會保留');
  });

  it('undoes a merge that a failing write left behind (orphan regression)', async () => {
    initImporter({
      persistAndRender: () => {
        throw new Error('cache exploded');
      },
    });
    completeWith([{ id: '1', title: 'x' }]);

    await handleFileUploads([csvFile()]);

    const { bookmarks } = await import('../src/core/state.js');
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

    const { bookmarks } = await import('../src/core/state.js');
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

// ---- duplicate name resolution --------------------------------------------
describe('handleFileUploads — duplicate name resolution', () => {
  const seedDuplicate = () => {
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv', originalData: '' }]]));
    setBookmarks([{ id: '1', source_file_id: 'F1', title: 'old' }]);
  };

  it('overwrite: replaces the old source and its bookmarks in a single transaction', async () => {
    seedDuplicate();
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
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
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
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
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
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
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
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

// ---- source picker modal ----------------------------------------------------
describe('import source modal', () => {
  it('opens from the import button as the top stack layer', () => {
    registerImporterListeners();

    el('importBtn').dispatch('click');

    expect(stackDepth()).toBe(1);
    expect(el('importModal').classList.contains('hidden')).toBe(false);
    expect(el('importModal').getAttribute('aria-hidden')).toBe('false');
    // Background roots go inert while the modal is open.
    expect(el('appHeader').inert).toBe(true);
  });

  it('is re-entrant on open and closes via the cancel button', () => {
    registerImporterListeners();

    el('importBtn').dispatch('click');
    el('importBtn').dispatch('click'); // second open must not stack a duplicate layer
    expect(stackDepth()).toBe(1);

    el('importCancelBtn').dispatch('click');
    expect(stackDepth()).toBe(0);
    expect(el('importModal').classList.contains('hidden')).toBe(true);
    expect(el('appHeader').inert).toBe(false);
  });

  it('closes on backdrop click but not when the panel itself is clicked', () => {
    registerImporterListeners();
    const overlay = el('importModal');
    el('importBtn').dispatch('click');

    overlay.dispatch('click', { target: {} }); // bubbled click from inside the panel
    expect(stackDepth()).toBe(1);

    overlay.dispatch('click', { target: overlay }); // backdrop
    expect(stackDepth()).toBe(0);
  });

  it('selects a card on click, syncing aria-checked and border classes', () => {
    registerImporterListeners();

    el('importProfile-rll-unified').dispatch('click');

    const unified = el('importProfile-rll-unified');
    const scraper = el('importProfile-instapaper-scraper');
    expect(unified.getAttribute('aria-checked')).toBe('true');
    expect(scraper.getAttribute('aria-checked')).toBe('false');
    expect(unified.classList.contains('border-indigo-500')).toBe(true);
    expect(unified.classList.contains('border-slate-700')).toBe(false);
    expect(scraper.classList.contains('border-slate-700')).toBe(true);
    expect(scraper.classList.contains('border-indigo-500')).toBe(false);
  });

  it('moves the selection with arrow keys and wraps around', () => {
    registerImporterListeners();
    const group = el('importSourceGroup');
    const preventDefault = vi.fn();

    group.dispatch('keydown', { key: 'ArrowDown', preventDefault });
    expect(el('importProfile-rll-unified').getAttribute('aria-checked')).toBe('true');
    expect(preventDefault).toHaveBeenCalled();

    group.dispatch('keydown', { key: 'ArrowUp', preventDefault });
    expect(el('importProfile-instapaper-scraper').getAttribute('aria-checked')).toBe('true');
  });

  it('opens the hidden file input from the pick-file button', () => {
    registerImporterListeners();

    el('importPickFileBtn').dispatch('click');

    expect(el('fileInput').click).toHaveBeenCalledTimes(1);
  });

  it('change closes the modal, clears the input value and stamps the profile', async () => {
    registerImporterListeners();
    el('importBtn').dispatch('click');
    el('importProfile-rll-unified').dispatch('click');

    const target = { files: [fakeFile('z.csv', 'id,title\n1,hi')], value: 'C:\\fake\\z.csv' };
    el('fileInput').dispatch('change', { target });
    await new Promise((r) => setTimeout(r, 0));

    expect(stackDepth()).toBe(0);
    expect(target.value).toBe(''); // same file can be re-selected later
    expect(globalThis.Papa.parse).toHaveBeenCalledTimes(1);
    const [rec] = [...sourceFiles.values()];
    expect(rec.profile).toBe('rll-unified');
  });

  it('defaults to the InstapaperScraper profile when none is chosen', async () => {
    registerImporterListeners();

    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,x')]);

    const [rec] = [...sourceFiles.values()];
    expect(rec.profile).toBe('instapaper-scraper');
  });
});

// ---- header sanity check -----------------------------------------------------
describe('handleFileUploads — header sanity check', () => {
  it('blocks the official Instapaper CSV with guidance and registers nothing', async () => {
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
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
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
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
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
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

    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
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

// ---- validation (URL-less rows dropped by the adapter) ----------------------
describe('handleFileUploads — row validation reporting', () => {
  it('reports URL-less rows the adapter dropped and keeps the source', async () => {
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [
          { id: '1', title: 'ok', url: 'https://a.example.com' },
          { id: '2', title: 'no url' },
          { id: '3', title: 'also no url' },
        ],
        errors: [],
      });
    });
    // The real adapter drops URL-less rows; simulate its output here.
    vi.mocked(importJsonOrCsv).mockImplementationOnce((rows) =>
      rows.filter((r) => r.url).map((r) => ({ id: r.id, title: r.title })),
    );

    await handleFileUploads([fakeFile('mixed.csv', 'id,title,url\n…')]);

    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe('已載入檔案: mixed.csv（1 筆書籤，2 筆缺少網址已略過）');
  });

  it('combines parse failures and dropped rows in one summary', async () => {
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [
          { id: '1', title: 'ok', url: 'https://a.example.com' },
          { id: '2', title: 'no url' },
        ],
        errors: [{ row: 5, message: 'Too few fields' }],
      });
    });
    vi.mocked(importJsonOrCsv).mockImplementationOnce((rows) =>
      rows.filter((r) => r.url).map((r) => ({ id: r.id, title: r.title })),
    );

    await handleFileUploads([fakeFile('both.csv', 'id,title,url\n…')]);

    expect(el('toastMsg').innerText).toBe(
      '已載入檔案: both.csv（1 筆書籤，1 列解析失敗、1 筆缺少網址已略過）',
    );
  });

  it('reports an all-invalid file with zero imported bookmarks', async () => {
    globalThis.Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({
        data: [
          { id: '1', title: 'a' },
          { id: '2', title: 'b' },
        ],
        errors: [],
      });
    });
    vi.mocked(importJsonOrCsv).mockImplementationOnce(() => []);

    await handleFileUploads([fakeFile('nourl.csv', 'id,title\n…')]);

    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe('已載入檔案: nourl.csv（0 筆書籤，2 筆缺少網址已略過）');
  });
});

// ---- listener registration -------------------------------------------------
// ---- batch resilience (fail-closed DOM assumptions) -------------------------
describe('handleFileUploads — batch resilience', () => {
  const seedDuplicate = () => {
    setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv', originalData: '' }]]));
    setBookmarks([{ id: '1', source_file_id: 'F1', title: 'old' }]);
  };

  /** Hide specific ids from the stub document; call restore() to put them back. */
  const hideNodes = (ids) => {
    const missing = new Set(ids);
    const spy = vi
      .spyOn(globalThis.document, 'getElementById')
      .mockImplementation((id) => (missing.has(id) ? null : el(id)));
    return { missing, restore: () => spy.mockRestore() };
  };

  it('refuses a colliding batch before importing anything when the prompt body is missing', async () => {
    seedDuplicate();
    const prompt = hideNodes(['duplicateFileText']);
    try {
      await handleFileUploads([
        fakeFile('b.csv', 'id,title\n1,x'),
        fakeFile('a.csv', 'id,title\n2,y'),
      ]);
    } finally {
      prompt.restore();
    }

    // Refused before anything was parsed or staged: no partial import, and the
    // file queued ahead of the collision is not sacrificed either.
    expect(globalThis.Papa.parse).not.toHaveBeenCalled();
    expect(sourceFiles.size).toBe(1);
    expect(sourceFiles.get('F1').name).toBe('a.csv');
    expect(bookmarks.map((b) => b.id)).toEqual(['1']);
    expect(el('toastMsg').innerText).toBe(
      '無法顯示同名檔案的處理選項，因此未匯入任何檔案（a.csv）。請重新載入頁面後再試。',
    );
  });
  it('refuses instead of hanging when a duplicate-modal control is missing', async () => {
    seedDuplicate();
    const prompt = hideNodes(['dupBtnOverwrite']);
    try {
      // Would time out if the resolver waited for a reply no button can give.
      await handleFileUploads([fakeFile('a.csv', 'id,title\n2,y')]);
    } finally {
      prompt.restore();
    }

    expect(globalThis.Papa.parse).not.toHaveBeenCalled();
    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe(
      '無法顯示同名檔案的處理選項，因此未匯入任何檔案（a.csv）。請重新載入頁面後再試。',
    );
  });

  it('imports a collision-free batch even when the duplicate prompt markup is missing', async () => {
    let rows = 0;
    globalThis.Papa.parse.mockImplementation((_text, config) =>
      config.complete({ data: [{ id: String(++rows), title: 'x' }], errors: [] }),
    );
    const prompt = hideNodes(['duplicateFileText', 'dupBtnKeepBoth']);
    try {
      await handleFileUploads([
        fakeFile('b.csv', 'id,title\n1,x'),
        fakeFile('c.csv', 'id,title\n2,y'),
      ]);
    } finally {
      prompt.restore();
    }

    expect([...sourceFiles.values()].map((f) => f.name)).toEqual(['b.csv', 'c.csv']);
    expect(bookmarks.map((b) => b.id)).toEqual(['1', '2']);
  });
  it('keeps importing the remaining files when one file fails to parse', async () => {
    globalThis.Papa.parse.mockImplementationOnce((_text, config) =>
      config.complete({ data: [], errors: [{ message: 'broken row' }] }),
    );

    await handleFileUploads([
      fakeFile('bad.csv', 'id,title\n'), // a handled failure: that file alone
      fakeFile('ok.csv', 'id,title\n1,x'),
    ]);

    expect([...sourceFiles.values()].map((f) => f.name)).toEqual(['ok.csv']);
    expect(el('toastMsg').innerText).toBe('已載入檔案: ok.csv，但未偵測到任何書籤');
  });

  it('rolls the whole batch back when a file fails unexpectedly after one committed', async () => {
    seedDuplicate();
    let parsed = 0;
    globalThis.Papa.parse.mockImplementation((_text, config) =>
      config.complete({ data: [{ id: `p${++parsed}`, title: 'x' }], errors: [] }),
    );

    const prompt = hideNodes([]);
    let writes = 0;
    const persistAndRender = vi.fn(async () => {
      writes += 1;
      // The prompt body disappears once the first file has committed — the DOM
      // assumption under review, hit one file later than the preflight checks.
      if (writes === 1) prompt.missing.add('duplicateFileText');
      return { persisted: true, rendered: true };
    });
    const render = vi.fn();
    initImporter({ persistAndRender, render });

    try {
      await handleFileUploads([
        fakeFile('x.csv', 'id,title\np1,x'), // commits
        fakeFile('a.csv', 'id,title\np2,y'), // collides with the seeded a.csv
        fakeFile('z.csv', 'id,title\np3,z'), // must never be attempted
      ]);
    } finally {
      prompt.restore();
    }

    expect(parsed).toBe(1); // only x.csv ever reached the parser
    expect(writes).toBe(2); // the commit, plus the rollback write
    expect(render).not.toHaveBeenCalled(); // the rollback write reported rendered
    expect([...sourceFiles.values()].map((f) => f.name)).toEqual(['a.csv']);
    expect(sourceFiles.has('F1')).toBe(true); // the seeded source came back
    expect(bookmarks.map((b) => b.id)).toEqual(['1']);
    expect(el('toastMsg').innerText).toBe('匯入「a.csv」時發生錯誤，已還原本次匯入的全部檔案');
  });

  it('reports honestly when the batch rollback itself cannot be cached', async () => {
    seedDuplicate();
    let parsed = 0;
    globalThis.Papa.parse.mockImplementation((_text, config) =>
      config.complete({ data: [{ id: `q${++parsed}`, title: 'x' }], errors: [] }),
    );

    const prompt = hideNodes([]);
    let writes = 0;
    const persistAndRender = vi.fn(async () => {
      writes += 1;
      if (writes === 1) prompt.missing.add('duplicateFileText');
      return writes === 1
        ? { persisted: true, rendered: true }
        : { persisted: false, rendered: true };
    });
    initImporter({ persistAndRender });

    try {
      await handleFileUploads([
        fakeFile('x.csv', 'id,title\nq1,x'),
        fakeFile('a.csv', 'id,title\nq2,y'),
        fakeFile('z.csv', 'id,title\nq3,z'),
      ]);
    } finally {
      prompt.restore();
    }

    // Memory is still rewound; only the cache rewrite failed, and the toast
    // must not pretend the restore was complete.
    expect([...sourceFiles.values()].map((f) => f.name)).toEqual(['a.csv']);
    expect(bookmarks.map((b) => b.id)).toEqual(['1']);
    expect(el('toastMsg').innerText).toBe(
      '匯入「a.csv」時發生錯誤，且無法還原快取；重新載入後可能仍會看到部分匯入結果',
    );
  });

  it('does not claim a rollback when nothing in the batch was committed yet', async () => {
    seedDuplicate();
    // The body node passes the preflight, then disappears before the prompt is
    // drawn: the loop's own guard fires while the commit count is still zero.
    let lookups = 0;
    const spy = vi.spyOn(globalThis.document, 'getElementById').mockImplementation((id) => {
      if (id === 'duplicateFileText' && ++lookups > 1) return null;
      return el(id);
    });
    const persistAndRender = vi.fn(async () => ({ persisted: true, rendered: true }));
    initImporter({ persistAndRender });

    try {
      await handleFileUploads([fakeFile('a.csv', 'id,title\n2,y')]);
    } finally {
      spy.mockRestore();
    }

    expect(persistAndRender).not.toHaveBeenCalled();
    expect(globalThis.Papa.parse).not.toHaveBeenCalled();
    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe(
      '無法顯示同名檔案的處理選項，因此未匯入任何檔案（a.csv）。請重新載入頁面後再試。',
    );
  });
});

describe('registerImporterListeners', () => {
  it('wires #fileInput change events to handleFileUploads', async () => {
    registerImporterListeners();
    const input = el('fileInput');

    input.dispatch('change', { target: { files: [fakeFile('z.csv', 'id,title\n1,hi')] } });
    await new Promise((r) => setTimeout(r, 0));

    expect(globalThis.Papa.parse).toHaveBeenCalledTimes(1);
  });

  it('awaits an unexpected import failure without leaking a rejection to the change event', async () => {
    setSourceFiles(
      new Map([
        [
          'broken',
          {
            get name() {
              throw new Error('unexpected state failure');
            },
          },
        ],
      ]),
    );
    registerImporterListeners();

    const input = el('fileInput');
    input.dispatch('change', { target: { files: [fakeFile('a.csv', 'id,title\n1,x')] } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el('toastMsg').innerText).toBe('檔案匯入失敗，請稍後再試');
  });

  it('no-ops when #fileInput is missing', () => {
    const spy = vi.spyOn(globalThis.document, 'getElementById').mockReturnValue(null);
    expect(() => registerImporterListeners()).not.toThrow();
    spy.mockRestore();
  });
});

/**
 * A unified export carries a `sources` manifest so a re-import can rebuild the
 * per-source folders the export was taken from.
 *
 * Before this, `importJsonOrCsv` stamped the NEW file's identity onto every
 * record, so N folders collapsed into one: the sidebar listed a single entry,
 * folder counts were wrong, and saving back could only ever write one file.
 *
 * The adapter is mocked here and stamps the id it is HANDED, which is exactly
 * the seam this feature uses — rows are partitioned per source first, then each
 * group is adapted with its own id, so ownership is never rewritten afterwards.
 */
describe('handleFileUploads — unified source manifest', () => {
  const bookmark = (id, sourceFileId, sourceFileName) => ({
    id,
    title: `t-${id}`,
    url: `https://example.com/${id}`,
    source_file_id: sourceFileId,
    source_file_name: sourceFileName,
  });

  const envelope = (sources, bookmarks) =>
    JSON.stringify({ format: 'read-later-lens', version: 2, sources, bookmarks });

  const importUnified = (text) => {
    applyProfileSelection('rll-unified');
    return handleFileUploads([fakeFile('all_bookmarks_export.json', text)]);
  };

  it('rebuilds one source per manifest entry instead of collapsing them into one', async () => {
    await importUnified(
      envelope(
        [
          { id: 'file_a', name: 'instapaper.csv', type: 'csv' },
          { id: 'file_b', name: 'raindrop.json', type: 'json' },
        ],
        [
          bookmark('1', 'file_a', 'instapaper.csv'),
          bookmark('2', 'file_b', 'raindrop.json'),
          bookmark('3', 'file_a', 'instapaper.csv'),
        ],
      ),
    );

    expect(sourceFiles.size).toBe(2);
    expect([...sourceFiles.values()].map((f) => f.name).sort()).toEqual([
      'instapaper.csv',
      'raindrop.json',
    ]);
    // The counts the sidebar renders come from these ids.
    const byFolder = new Map();
    for (const b of bookmarks) {
      byFolder.set(b.source_file_id, (byFolder.get(b.source_file_id) || 0) + 1);
    }
    expect(byFolder.get('file_a')).toBe(2);
    expect(byFolder.get('file_b')).toBe(1);
  });

  it('leaves no active record pointing at a source that does not exist', async () => {
    // A record whose owner is unregistered is invisible in the sidebar AND
    // unreachable by the folder filter — the one failure mode worth guarding.
    await importUnified(
      envelope(
        [{ id: 'file_a', name: 'instapaper.csv', type: 'csv' }],
        [bookmark('1', 'file_a', 'instapaper.csv'), bookmark('2', 'ghost', 'nowhere.csv')],
      ),
    );

    for (const b of bookmarks) {
      expect(sourceFiles.has(b.source_file_id)).toBe(true);
    }
  });

  it('restores a folder for a record the manifest does not mention, named from its own row', async () => {
    await importUnified(
      envelope(
        [{ id: 'file_a', name: 'instapaper.csv', type: 'csv' }],
        [bookmark('1', 'file_a', 'instapaper.csv'), bookmark('2', 'ghost', 'hand-edited.csv')],
      ),
    );

    expect(sourceFiles.get('ghost').name).toBe('hand-edited.csv');
  });
  it('keeps the existing source record when the incoming id is already taken', async () => {
    const richer = { id: 'file_a', name: 'original.csv', type: 'csv', originalData: 'keep me' };
    setSourceFiles(new Map([['file_a', richer]]));

    await importUnified(
      envelope(
        [{ id: 'file_a', name: 'from-export.csv', type: 'csv' }],
        [bookmark('1', 'file_a', 'from-export.csv')],
      ),
    );

    // Clobbering it would discard the payload the source was loaded from.
    expect(sourceFiles.get('file_a').name).toBe('original.csv');
    expect(sourceFiles.get('file_a').originalData).toBe('keep me');
    expect(bookmarks[0].source_file_id).toBe('file_a');
  });

  it('rebuilds the folder an overwrite just deleted instead of orphaning its records', async () => {
    // Importing a unified export under any non-unified profile registers it as a
    // single source named after the file. Re-importing that export under the
    // unified profile collides by name, and choosing 覆寫 purges the source —
    // whose id is exactly the one the envelope's manifest names. If the reuse
    // decision were made before the purge, this group would be merged into a
    // record that is then deleted, leaving every row pointing at a folder that
    // does not exist: invisible in the sidebar, unreachable by the folder
    // filter, and unsaveable, behind a success toast.
    applyProfileSelection('rll-unified');
    setSourceFiles(
      new Map([['file_a', { id: 'file_a', name: 'all_bookmarks_export.json', type: 'json' }]]),
    );
    setBookmarks([{ id: 'stale', title: 'old', source_file_id: 'file_a' }]);

    await uploadResolving(
      [
        fakeFile(
          'all_bookmarks_export.json',
          envelope(
            [{ id: 'file_a', name: 'a.csv', type: 'csv' }],
            [bookmark('1', 'file_a', 'a.csv'), bookmark('2', 'file_a', 'a.csv')],
          ),
        ),
      ],
      'overwrite',
    );

    expect(sourceFiles.size).toBe(1);
    expect(sourceFiles.get('file_a').name).toBe('a.csv');
    // The replaced bookmark is gone, the envelope's rows are not, and every row
    // still has a source to belong to.
    expect(bookmarks.map((b) => b.id)).toEqual(['1', '2']);
    for (const b of bookmarks) {
      expect(sourceFiles.has(b.source_file_id)).toBe(true);
    }
  });

  it('rebuilds folders for a legacy envelope that has no manifest at all', async () => {
    // Unified exports have always carried per-record source ids; only the
    // manifest is new, so an older file still has enough to restore folders.
    await importUnified(
      JSON.stringify({
        format: 'read-later-lens',
        version: 1,
        bookmarks: [bookmark('1', 'file_a', 'a.csv'), bookmark('2', 'file_b', 'b.json')],
      }),
    );

    expect(sourceFiles.size).toBe(2);
    expect(sourceFiles.get('file_a').name).toBe('a.csv');
    expect(sourceFiles.get('file_b').name).toBe('b.json');
  });

  it('registers no folder for the uploaded file itself when every row names a source', async () => {
    // Otherwise re-importing a whole-library export would leave a bogus extra
    // "all_bookmarks_export.json" folder sitting next to the real ones.
    await importUnified(JSON.stringify([bookmark('1', 'file_a', 'a.csv')]));

    expect(sourceFiles.size).toBe(1);
    expect([...sourceFiles.keys()]).toEqual(['file_a']);
    expect(sourceFiles.get('file_a').name).toBe('a.csv');
  });

  it('keeps the imported file as the owner for rows that carry no source id', async () => {
    await importUnified(
      envelope(
        [{ id: 'file_a', name: 'a.csv', type: 'csv' }],
        [{ id: '1', title: 'x', url: 'https://example.com/1' }],
      ),
    );

    const [file] = [...sourceFiles.values()];
    expect(sourceFiles.size).toBe(1);
    expect(bookmarks[0].source_file_id).toBe(file.id);
  });

  it('leaves grouping to the unified profile only, so a scraper import stays one source', async () => {
    // The rows still carry source ids, but under the scraper profile the user's
    // choice wins: those ids are the app's, not the file's.
    applyProfileSelection('instapaper-scraper');
    await handleFileUploads([
      fakeFile(
        'rows.json',
        JSON.stringify([bookmark('1', 'file_a', 'a.csv'), bookmark('2', 'file_b', 'b.json')]),
      ),
    ]);

    expect(sourceFiles.size).toBe(1);
  });

  it('rebuilds folders from the source columns of a unified CSV, which carries no manifest', async () => {
    // The unified CSV has no envelope to hang a manifest on, but it already
    // writes `source_file_id` / `source_file_name` on every row, which is the
    // same information — so the round trip is just as faithful.
    applyProfileSelection('rll-unified');
    globalThis.Papa.parse.mockImplementationOnce((_text, config) =>
      config.complete({
        data: [
          bookmark('1', 'file_a', 'a.csv'),
          bookmark('2', 'file_b', 'b.json'),
          bookmark('3', 'file_a', 'a.csv'),
        ],
        errors: [],
        meta: { fields: ['id', 'url', 'source_file_id', 'source_file_name'] },
      }),
    );

    await handleFileUploads([fakeFile('all_bookmarks_export.csv', 'irrelevant')]);

    expect(sourceFiles.size).toBe(2);
    expect(sourceFiles.get('file_a').name).toBe('a.csv');
    expect(sourceFiles.get('file_b').name).toBe('b.json');
    for (const b of bookmarks) expect(sourceFiles.has(b.source_file_id)).toBe(true);
  });
});
