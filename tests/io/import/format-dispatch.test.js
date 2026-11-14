import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { initImporter, handleFileUploads, applyProfileSelection } from '@/io/import';
import { defaultProfileId } from '@/providers/profiles.js';
import { importJsonOrCsv, importSqlite } from '@/providers';
import { setBookmarks, setSourceFiles, sourceFiles } from '@/core/state';
import { setSQL } from '@/services/sqlEngine.js';
import { resetLayers } from '@/utils/dom';

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

// ---- handleFileUploads — format dispatch ------------------------------------
describe('handleFileUploads — format dispatch', () => {
  it('parses CSV via Papa with monolith options and registers the source file', async () => {
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: '1', title: 'hello' }], errors: [] });
    });
    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,hello')]);

    expect(Papa.parse).toHaveBeenCalledTimes(1);
    const [text, config] = Papa.parse.mock.calls[0];
    expect(text).toBe('id,title\n1,hello');
    expect(config.header).toBe(true);
    expect(config.skipEmptyLines).toBe(true);

    const [id] = [...sourceFiles.keys()];
    expect(id).toMatch(
      /^file_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const rec = sourceFiles.get(id);
    expect(rec.name).toBe('a.csv');
    expect(rec.type).toBe('csv');
    expect(rec.originalData).toBe('id,title\n1,hello');

    // The awaited Papa completion drove the merge + persist synchronously.
    expect(importJsonOrCsv).toHaveBeenCalledWith([{ id: '1', title: 'hello' }], id, 'a.csv');
  });

  it('shows the success toast with the zh-TW message', async () => {
    Papa.parse.mockImplementationOnce((text, config) => {
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
    const { SQL: engine } = await import('@/services/sqlEngine.js');
    await handleFileUploads([fakeFile('instapaper.db', 'binary')]);

    expect(initSql).toHaveBeenCalledTimes(1);
    expect(importSqlite).toHaveBeenCalledTimes(1);
    const [bytes, id, name, usedEngine] = importSqlite.mock.calls[0];
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(id).toMatch(
      /^file_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
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
    Papa.parse.mockImplementationOnce((_text, config) =>
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

  it('stamps the observed CSV dialect onto the source record', async () => {
    // Papa reports the delimiter and terminator it detected, so the dialect is
    // recorded rather than guessed at save time. Without it a `;`-delimited or
    // LF source comes back comma + CRLF, breaking the pipeline it came from.
    Papa.parse.mockImplementationOnce((_text, config) =>
      config.complete({
        data: [{ id: '1', title: 't', url: 'https://a.com' }],
        errors: [],
        meta: { fields: ['id', 'title', 'url', 'preview'], delimiter: ';', linebreak: '\n' },
      }),
    );

    await handleFileUploads([fakeFile('a.csv', 'id;title;url;preview\n1;t;https://a.com;p')]);

    const [file] = [...sourceFiles.values()];
    expect(file.csvDialect).toEqual({ delimiter: ';', linebreak: '\n' });
  });

  it('records no dialect when Papa reports none, instead of guessing one', async () => {
    // The default parse mock returns no `meta`. A guessed dialect would be worse
    // than RFC 4180: a file written with one separator comes back with another.
    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,t')]);

    const [file] = [...sourceFiles.values()];
    expect(file.csvDialect).toBeNull();
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
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: 'dup', title: 'new' }], errors: [] });
    });

    const pending = handleFileUploads([fakeFile('a.csv', 'id,title\n1,hello')]);
    await new Promise((r) => setTimeout(r, 0));
    const [id] = [...sourceFiles.keys()];
    await pending;

    expect(persist).toHaveBeenCalled();
    const { bookmarks } = await import('../../../src/core/state');
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
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: 'dup', title: 'fresh' }] });
    });

    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,hello')]);

    // The trash entry is discarded in favour of the freshly imported record
    // (mergeBookmarks is incoming-wins), so the toast flags the displacement.
    expect(el('toastMsg').innerText).toBe(
      '已成功載入檔案: a.csv（1 筆已存在於回收桶的書籤已被新匯入資料取代）',
    );
    const { bookmarks } = await import('../../../src/core/state');
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].title).toBe('fresh');
    expect(bookmarks[0].deleted_at).toBeUndefined();
  });

  it('keeps the plain success toast when the import displaces nothing', async () => {
    setBookmarks([{ id: 'dup', title: 'deleted copy', deleted_at: '2026-01-01T00:00:00.000Z' }]);
    Papa.parse.mockImplementationOnce((text, config) => {
      config.complete({ data: [{ id: 'other', title: 'new' }] });
    });

    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,hello')]);

    expect(el('toastMsg').innerText).toBe('已成功載入檔案: a.csv');
    const { bookmarks } = await import('../../../src/core/state');
    expect(bookmarks).toHaveLength(2);
  });
});
