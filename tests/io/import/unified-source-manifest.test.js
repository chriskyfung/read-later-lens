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

  it("falls back to the envelope's own profile when a manifest profile is unknown", async () => {
    await importUnified(
      envelope(
        [{ id: 'file_a', name: 'instapaper.csv', type: 'csv', profile: 'from-the-future' }],
        [bookmark('1', 'file_a', 'instapaper.csv')],
      ),
    );

    // The user's own choice for this import is the honest label: a global
    // default would narrow this source's export to the scraper's columns.
    expect([...sourceFiles.values()].map((f) => f.profile)).toEqual(['rll-unified']);
  });

  it('honours a manifest profile that this build does offer', async () => {
    await importUnified(
      envelope(
        [{ id: 'file_a', name: 'instapaper.csv', type: 'csv', profile: 'instapaper-scraper' }],
        [bookmark('1', 'file_a', 'instapaper.csv')],
      ),
    );

    expect([...sourceFiles.values()].map((f) => f.profile)).toEqual(['instapaper-scraper']);
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

  it('stamps merged rows with the existing folder name, not the manifest name', async () => {
    setSourceFiles(
      new Map([['file_a', { id: 'file_a', name: 'original.csv', type: 'csv', originalData: 'k' }]]),
    );

    await importUnified(
      envelope(
        [{ id: 'file_a', name: 'from-export.csv', type: 'csv' }],
        [bookmark('1', 'file_a', 'from-export.csv')],
      ),
    );

    // The source record is deliberately not rewritten, so letting the manifest
    // name through would leave the folder reading "original.csv" while every
    // record inside it claimed to come from "from-export.csv".
    expect(sourceFiles.get('file_a').name).toBe('original.csv');
    expect(bookmarks[0].source_file_name).toBe('original.csv');
  });

  it('falls back to the manifest name when the loaded source record has none', async () => {
    // saveState round-trips a record's own name, but migrateLegacyDb copies
    // sources rows verbatim out of the pre-rebrand database, whose shape this app
    // does not control, so a nameless record is reachable on load. Preferring its
    // name blindly would label every merged row with undefined.
    setSourceFiles(new Map([['file_a', { id: 'file_a', type: 'csv', originalData: 'k' }]]));

    await importUnified(
      envelope(
        [{ id: 'file_a', name: 'from-export.csv', type: 'csv' }],
        [bookmark('1', 'file_a', 'from-export.csv')],
      ),
    );

    expect(bookmarks[0].source_file_name).toBe('from-export.csv');
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
    Papa.parse.mockImplementationOnce((_text, config) =>
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
    // The header row captured above describes the ENVELOPE, not either folder.
    // Handing it to a reconstructed source would make save-back re-emit the
    // unified schema for it — the very mismatch per-source layout capture exists
    // to prevent — so it is cleared and the profile default takes over.
    expect(sourceFiles.get('file_a').csvColumns).toBe(null);
    expect(sourceFiles.get('file_b').csvColumns).toBe(null);
    // Same for the dialect: it describes the uploaded export's bytes, so handing
    // it to a rebuilt folder would make a ;-delimited envelope re-emit every
    // restored source with semicolons.
    expect(sourceFiles.get('file_a').csvDialect).toBe(null);
    expect(sourceFiles.get('file_b').csvDialect).toBe(null);
    // Likewise the envelope's extension: this file is a CSV, but `b.json` was
    // always a JSON source, and save-back would otherwise write CSV text under
    // that name for the user to discover on their filesystem.
    expect(sourceFiles.get('file_b').type).toBe('json');
  });

  it('gives a folder restored from a legacy envelope the type its own name implies', async () => {
    // Same defect on the JSON path. A v1 export carries no manifest, so the type
    // has to come from the folder's own name; inheriting the envelope's would
    // make every restored folder JSON, whatever the originals were.
    await importUnified(
      JSON.stringify({
        format: 'read-later-lens',
        version: 1,
        bookmarks: [bookmark('1', 'file_a', 'a.csv')],
      }),
    );

    expect(sourceFiles.get('file_a').type).toBe('csv');
  });

  it('refuses a manifest type the app cannot write and falls back to the folder name', async () => {
    // `type` is what `saveSingleFile` branches on and it has no final else, so an
    // unrecognized value makes the save button do nothing at all: no file, no
    // toast, no error. A manifest is untrusted input, so its type is honoured
    // only when the app can actually write it.
    await importUnified(
      envelope(
        [{ id: 'file_a', name: 'a.csv', type: 'application/pdf' }],
        [bookmark('1', 'file_a', 'a.csv')],
      ),
    );

    expect(sourceFiles.get('file_a').type).toBe('csv');
  });
});
