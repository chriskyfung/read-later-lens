import { describe, it, expect, vi } from 'vitest';
import { handleFileUploads } from './batch.js';
import { initImporter } from './deps.js';
import { sourceFiles } from '@/core/state';

// Mock PapaParse at top level. The `vi.mock` factory is hoisted to the
// top of the file, before the rest of the module body executes. If `Papa`
// were a plain top-level const, the hoisted factory would try to read it
// while it is still in the temporal dead zone (`ReferenceError`). `vi.hoisted`
// defers the object construction until after that hoisted position executes,
// so the factory can safely reference the same object below.
const Papa = vi.hoisted(() => ({
  parse: vi.fn(),
  unparse: vi.fn(() => 'csv-content'),
}));

vi.mock('papaparse', () => ({
  default: Papa,
}));

// Minimal DOM and state stubs
globalThis.sourceFiles = new Map();
globalThis.bookmarks = [];
globalThis.selectedIds = new Set();
globalThis.activeFolder = 'ALL';
globalThis.el = (id) => ({
  id,
  innerText: '',
  innerHTML: '',
  className: '',
  value: '',
  style: {},
  inert: false,
  parentElement: null,
  _attrs: {},
  _l: {},
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  setAttribute: vi.fn(),
  getAttribute: vi.fn(),
  removeAttribute: vi.fn(),
  classList: { _s: new Set(['hidden']), add: vi.fn(), remove: vi.fn() },
});
globalThis.document = {
  getElementById: (id) => globalThis.el(id),
};

const fakeFile = (name, content) => ({
  name,
  type: name.endsWith('.csv') ? 'csv' : name.endsWith('.json') ? 'json' : 'unsupported',
  text: () => Promise.resolve(content),
  arrayBuffer: () => Promise.resolve(new Uint8Array(0)),
});

describe('handleFileUploads - basic import', () => {
  it('imports a single CSV file successfully', async () => {
    Papa.parse.mockImplementationOnce((_text, config) => {
      config.complete({
        data: [{ id: '1', title: 'x', url: 'https://x.example.com' }],
        errors: [],
      });
    });

    initImporter({ persistAndRender: vi.fn(), render: vi.fn() });

    await handleFileUploads([fakeFile('test.csv', 'id,title,url\n1,x,https://x.example.com')]);

    expect(sourceFiles.size).toBe(1);
    expect([...sourceFiles.values()][0].name).toBe('test.csv');
  });
});
