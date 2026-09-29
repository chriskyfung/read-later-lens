import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { handleFileUploads, initImporter, applyProfileSelection } from '../src/io/importer.js';
import { saveSingleFile } from '../src/io/exporter.js';
import { defaultProfileId } from '../src/providers/profiles.js';
import { saveFileWithFallback } from '../src/utils/download.js';
import { setBookmarks, setSourceFiles, setSQL, sourceFiles } from '../src/core/state.js';
import { resetLayers } from '../src/utils/dom.js';

vi.mock('../src/utils/download.js', () => ({
  downloadBlob: vi.fn(),
  saveFileWithFallback: vi.fn(async () => {}),
}));

// ---- DOM stubs -----------------------------------------------------------
const els = {};
function makeEl() {
  return {
    dataset: {},
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
      toggle(c, force) {
        if (force === undefined) force = !this._s.has(c);
        if (force) this._s.add(c);
        else this._s.delete(c);
        return Boolean(force);
      },
    },
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    querySelector(selector) {
      this.elements ||= {};
      return (this.elements[selector] ||= makeEl());
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
  // Real PapaParse on BOTH sides — and now literally the same module object
  // the app imports, since `src/io/` takes the library from the `papaparse`
  // dependency instead of a global. The other importer and exporter tests mock
  // that import because they assert on the call; here the call is not the
  // subject — the bytes the user gets back are — so a mock would only assert
  // that the mock round-trips.
});

beforeEach(() => {
  resetLayers();
  for (const k of Object.keys(els)) delete els[k];
  setBookmarks([]);
  setSourceFiles(new Map());
  setSQL(null);
  initImporter({ persistAndRender: vi.fn(), render: vi.fn() });
  // The same setup `io-importer.test.js` uses, and load-bearing here: without
  // an active profile the exporter's `getActiveBookmarks()` has nothing to
  // select, and the save-back emits an empty file.
  applyProfileSelection(defaultProfileId());
  vi.mocked(saveFileWithFallback).mockClear();
});

const imported = async (name, text) => {
  await handleFileUploads([fakeFile(name, text)]);
  const [id] = [...sourceFiles.keys()];
  return { id, record: sourceFiles.get(id) };
};

// The seam the dialect tests on each side cannot reach: the importer decides
// the dialect and the exporter replays it, and both halves have to agree for a
// file to come back unchanged. Neither `io-importer.test.js` nor
// `io-exporter.test.js` imports the other module, so nothing else joined them.
describe('import then save-back reproduces the file', () => {
  it('reproduces a semicolon-delimited LF file byte for byte', async () => {
    // A trailing newline is not preserved, so the fixture has none.
    const original = 'id;title;url;preview;tags\n1;t1;https://a.com;p;news';

    const { id, record } = await imported('a.csv', original);

    // Observed from the real bytes by the real parser, through the real import
    // path — not hand-seeded the way the exporter tests seed a dialect.
    expect(record.csvDialect).toEqual({ delimiter: ';', linebreak: '\n' });
    expect(record.csvColumns).toEqual(['id', 'title', 'url', 'preview', 'tags']);

    await saveSingleFile(id);

    const [emitted] = vi.mocked(saveFileWithFallback).mock.calls[0];
    expect(emitted).toBe(original);
  });

  it('reproduces a tab-delimited LF file byte for byte', async () => {
    const original = 'id\ttitle\turl\n1\tt1\thttps://a.com';

    const { id, record } = await imported('a.csv', original);

    expect(record.csvDialect).toEqual({ delimiter: '\t', linebreak: '\n' });

    await saveSingleFile(id);

    const [emitted] = vi.mocked(saveFileWithFallback).mock.calls[0];
    expect(emitted).toBe(original);
  });

  it('reproduces a CRLF comma file byte for byte', async () => {
    // Two rows, so the terminator is checked between records and not only after
    // the header — and a `url` column, because a row the active profile cannot
    // use is dropped on import and would make this assert an empty file.
    const original = 'id,title,url\r\n1,t1,https://a.com\r\n2,t2,https://b.com';

    const { id, record } = await imported('a.csv', original);

    expect(record.csvDialect).toEqual({ delimiter: ',', linebreak: '\r\n' });

    await saveSingleFile(id);

    const [emitted] = vi.mocked(saveFileWithFallback).mock.calls[0];
    expect(emitted).toBe(original);
  });
});
