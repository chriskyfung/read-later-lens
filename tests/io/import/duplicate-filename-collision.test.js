import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { initImporter, handleFileUploads, applyProfileSelection } from '@/io/import';
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

// ---- duplicate filename collision handling -------------------------------
describe('handleFileUploads — duplicate filename collision', () => {
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

  it('imports a collision-free batch even when the duplicate prompt markup is missing', async () => {
    let rows = 0;
    Papa.parse.mockImplementation((_text, config) =>
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
    Papa.parse.mockImplementationOnce((_text, config) =>
      config.complete({ data: [], errors: [{ message: 'broken row' }] }),
    );

    await handleFileUploads([
      fakeFile('bad.csv', 'id,title\n'), // a handled failure: that file alone
      fakeFile('ok.csv', 'id,title\n1,x'),
    ]);

    expect([...sourceFiles.values()].map((f) => f.name)).toEqual(['ok.csv']);
    // The batch owns the one toast: the failure is named, not overwritten by
    // the later success. ok.csv parses to a URL-less record, so the batch
    // reports it the same way a single import would.
    expect(el('toastMsg').innerText).toBe(
      '已成功載入 1 個檔案（共 0 筆書籤）；1 個檔案失敗：bad.csv（解析失敗）',
    );
  });

  it('summarizes an all-success batch without hiding any file', async () => {
    Papa.parse.mockImplementation((_text, config) =>
      config.complete({ data: [{ id: '1', title: 'x' }], errors: [] }),
    );

    await handleFileUploads([
      fakeFile('a.csv', 'id,title\n1,x'),
      fakeFile('b.csv', 'id,title\n1,y'),
    ]);

    expect([...sourceFiles.values()].map((f) => f.name)).toEqual(['a.csv', 'b.csv']);
    expect(el('toastMsg').innerText).toBe('已成功載入 2 個檔案（共 2 筆書籤）');
  });

  it('sums per-file gaps into the batch summary', async () => {
    let calls = 0;
    Papa.parse.mockImplementation((_text, config) => {
      calls += 1;
      return config.complete({
        // One row, with a URL so the adapter keeps it; the first file's
        // parse error lands in the skipped count, not the dropped count.
        data:
          calls === 1
            ? [{ id: '1', title: 'x', url: 'https://x.example.com' }]
            : [{ id: '2', title: 'y', url: 'https://y.example.com' }],
        errors: calls === 1 ? [{ message: 'broken row' }] : [],
      });
    });

    await handleFileUploads([
      fakeFile('partial.csv', 'id,title,url\n1,x,https://x.example.com'),
      fakeFile('ok.csv', 'id,title,url\n2,y,https://y.example.com'),
    ]);

    expect(el('toastMsg').innerText).toBe(
      '已成功載入 2 個檔案（共 2 筆書籤，共 1 列解析失敗已略過）',
    );
  });

  it('names the failing files when every file in the batch fails', async () => {
    await handleFileUploads([fakeFile('a.txt', 'nope'), fakeFile('b.txt', 'nope')]);

    expect(sourceFiles.size).toBe(0);
    expect(el('toastMsg').innerText).toBe(
      '2 個檔案均匯入失敗：a.txt（格式不支援）、b.txt（格式不支援）',
    );
  });

  it('collapses a long failure list to a count', async () => {
    await handleFileUploads([
      fakeFile('a.txt', 'nope'),
      fakeFile('b.txt', 'nope'),
      fakeFile('c.txt', 'nope'),
      fakeFile('d.txt', 'nope'),
    ]);

    expect(el('toastMsg').innerText).toBe(
      '4 個檔案均匯入失敗：a.txt（格式不支援）、b.txt（格式不支援）、c.txt（格式不支援）、等 4 個檔案',
    );
  });

  it('reports nothing when the only file is user-cancelled', async () => {
    seedDuplicate();

    await uploadResolving([fakeFile('a.csv', 'id,title\n2,y')], 'cancel');

    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe('');
  });

  it('rolls the whole batch back when a file fails unexpectedly after one committed', async () => {
    seedDuplicate();
    let parsed = 0;
    Papa.parse.mockImplementation((_text, config) =>
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
    Papa.parse.mockImplementation((_text, config) =>
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
    expect(Papa.parse).not.toHaveBeenCalled();
    expect(sourceFiles.size).toBe(1);
    expect(el('toastMsg').innerText).toBe(
      '無法顯示同名檔案的處理選項，因此未匯入任何檔案（a.csv）。請重新載入頁面後再試。',
    );
  });
});
