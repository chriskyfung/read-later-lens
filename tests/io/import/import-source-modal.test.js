import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  initImporter,
  handleFileUploads,
  registerImporterListeners,
  applyProfileSelection,
} from '@/io/import';
import { defaultProfileId } from '@/providers/profiles.js';
import { importJsonOrCsv, importSqlite } from '@/providers';
import { setBookmarks, setSourceFiles, sourceFiles } from '@/core/state';
import { setSQL } from '@/services/sqlEngine.js';
import { resetLayers, stackDepth } from '@/utils/dom/index.js';

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
    expect(Papa.parse).toHaveBeenCalledTimes(1);
    const [rec] = [...sourceFiles.values()];
    expect(rec.profile).toBe('rll-unified');
  });

  it('defaults to the InstapaperScraper profile when none is chosen', async () => {
    registerImporterListeners();

    await handleFileUploads([fakeFile('a.csv', 'id,title\n1,x')]);

    const [rec] = [...sourceFiles.values()];
    expect(rec.profile).toBe('instapaper-scraper');
  });

  it('keeps exactly one card checked when the requested profile is unknown', () => {
    registerImporterListeners();

    applyProfileSelection('bogus');

    const checked = ['importProfile-instapaper-scraper', 'importProfile-rll-unified'].filter(
      (id) => el(id).getAttribute('aria-checked') === 'true',
    );
    expect(checked).toEqual(['importProfile-instapaper-scraper']);
  });

  it('treats the disabled roadmap card as unknown and keeps the default selected', () => {
    registerImporterListeners();

    applyProfileSelection('more-sources');

    expect(el('importProfile-instapaper-scraper').getAttribute('aria-checked')).toBe('true');
    expect(el('importProfile-rll-unified').getAttribute('aria-checked')).toBe('false');
  });

  it('stamps the default profile when the session selection was unknown', async () => {
    registerImporterListeners();
    applyProfileSelection('bogus');

    await handleFileUploads([fakeFile('a.csv', 'id,title\\n1,x')]);

    const [rec] = [...sourceFiles.values()];
    expect(rec.profile).toBe(defaultProfileId());
  });

  it('stamps the default profile when a direct import names an unknown profile', async () => {
    registerImporterListeners();

    await handleFileUploads([fakeFile('a.csv', 'id,title\\n1,x')], { profile: 'bogus' });

    const [rec] = [...sourceFiles.values()];
    expect(rec.profile).toBe(defaultProfileId());
  });
});
