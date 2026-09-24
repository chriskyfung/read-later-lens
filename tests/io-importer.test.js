import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  initImporter,
  handleFileUploads,
  registerImporterListeners,
  applyProfileSelection,
} from '../src/io/importer.js';
import { defaultProfileId } from '../src/providers/profiles.js';
import { importJsonOrCsv, importSqlite } from '../src/providers/index.js';
import { setBookmarks, setSourceFiles, setSQL, sourceFiles } from '../src/core/state.js';
import { resetLayers, stackDepth } from '../src/utils/dom.js';

vi.mock('../src/providers/index.js', () => {
  const importJsonOrCsv = vi.fn((rows, sourceFileId, sourceFileName) =>
    rows.map((r, i) => ({
      id: r.id ?? 'n' + i,
      source_file_id: sourceFileId,
      source_file_name: sourceFileName,
      title: r.title ?? '',
    })),
  );
  const importSqlite = vi.fn(async (bytes, sourceFileId, sourceFileName) => [
    {
      id: 'sq1',
      source_file_id: sourceFileId,
      source_file_name: sourceFileName,
      bytes: bytes.length,
    },
  ]);
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
  resetLayers();
  for (const k of Object.keys(els)) delete els[k];
  setBookmarks([]);
  setSourceFiles(new Map());
  setSQL(fakeEngine);
  initImporter({ persistAndRender: vi.fn(), deleteFolder: vi.fn() });
  applyProfileSelection(defaultProfileId());
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
