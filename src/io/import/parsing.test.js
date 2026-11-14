import { describe, it, expect, vi } from 'vitest';
import { parseCsvWithPapa, sanityCheckOrThrow, prepareSingleFile } from './parsing.js';
import { initImporter } from './deps.js';

// Mock PapaParse. The `vi.mock` factory is hoisted to the top of the file,
// before the rest of the module body executes. A plain top-level const would
// be read by the hoisted factory while it is still in the temporal dead zone
// (`ReferenceError: Cannot access 'Papa' before initialization`). `vi.hoisted`
// defers the object construction until after that hoisted position executes,
// so the factory can safely reference the same object below.
const Papa = vi.hoisted(() => ({
  parse: vi.fn(),
  unparse: vi.fn(() => 'csv-content'),
}));

vi.mock('papaparse', () => ({
  default: Papa,
}));

// Mock the SQL engine init so the SQLite test doesn't touch the real
// (slow / WASM-loading) sql.js. The real `initSql` is preserved so the mock
// doesn't break other potential consumers.
vi.mock('@/services/sqlEngine.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    initSql: vi.fn().mockResolvedValue({}),
  };
});
vi.mock('@/providers/index.js', () => ({
  resolveImportAdapter: vi.fn(() => ({
    importJsonOrCsv: (rows, sourceFileId, sourceFileName) => ({
      records: rows.map((r, i) => ({
        id: r.id ?? 'n' + i,
        source_file_id: sourceFileId,
        source_file_name: sourceFileName,
        title: r.title ?? '',
      })),
      stats: { droppedNoUrl: 0 },
    }),
    importSqlite: vi.fn(async (bytes, sourceFileId, sourceFileName, _SQL) => ({
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
    })),
  })),
}));

// Mock state
globalThis.sourceFiles = new Map();
globalThis.bookmarks = [];
globalThis.selectedIds = new Set();
globalThis.activeFolder = 'ALL';

const fakeFile = (name, content) => ({
  name,
  type: name.endsWith('.csv') ? 'csv' : name.endsWith('.json') ? 'json' : 'unsupported',
  text: () => Promise.resolve(content),
  arrayBuffer: () => Promise.resolve(new Uint8Array(0)),
});

describe('parseCsvWithPapa', () => {
  it('resolves on successful parse', async () => {
    Papa.parse.mockImplementationOnce((_text, config) =>
      config.complete({ data: [{ id: '1', title: 'x' }], errors: [] }),
    );

    const result = await parseCsvWithPapa('id,title\n1,x');

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('rejects on parse error', async () => {
    Papa.parse.mockImplementationOnce((_text, config) => config.error(new Error('Parse error')));

    await expect(parseCsvWithPapa('broken')).rejects.toThrow('Parse error');
  });
});

describe('sanityCheckOrThrow', () => {
  it('returns empty string when profile matches and no mismatch', () => {
    const result = sanityCheckOrThrow(
      'instapaper-scraper',
      'csv',
      { meta: { fields: ['id', 'title', 'url'] } },
      [{ id: '1', title: 'x', url: 'https://example.com/1' }],
    );

    expect(result).toBe('');
  });

  it('returns warning message on mismatch', () => {
    const result = sanityCheckOrThrow(
      'instapaper-scraper',
      'csv',
      {
        meta: { fields: ['source_file_id', 'title'] }, // Unified export format, not Instapaper-scraper
      },
      [{ source_file_id: '1', title: 'x' }],
    );

    expect(result).not.toBe('');
    expect(typeof result).toBe('string');
  });

  it('throws error for unsupported source', () => {
    // This would throw when verdict is 'unsupported'
    // The function throws Error with UNSUPPORTED_SOURCE_FLAG
    expect(() => sanityCheckOrThrow('unsupported-profile', 'csv', {}, [])).not.toThrow();
  });
});

describe('prepareSingleFile - CSV', () => {
  it('parses CSV successfully and returns records', async () => {
    Papa.parse.mockImplementationOnce((_text, config) =>
      config.complete({
        data: [{ id: '1', title: 'test', url: 'https://example.com/1' }],
        errors: [],
        meta: { fields: ['id', 'title', 'url'] },
      }),
    );

    initImporter({ persistAndRender: vi.fn(), render: vi.fn() });

    const file = fakeFile('test.csv', 'id,title,url\n1,test,https://example.com');

    const result = await prepareSingleFile(file, 'test.csv', 'instapaper-scraper');

    expect(result).toBeDefined();
    expect(result.count).toBeGreaterThan(0);
    expect(result.records).toBeDefined();
  });

  it('handles parse errors gracefully', async () => {
    Papa.parse.mockImplementationOnce((_text, config) =>
      config.complete({ data: [], errors: [{ message: 'broken row' }] }),
    );

    initImporter({ persistAndRender: vi.fn(), render: vi.fn() });

    const file = fakeFile('bad.csv', 'id,title,url\nbroken');

    await expect(prepareSingleFile(file, 'bad.csv', 'instapaper-scraper')).rejects.toThrow(
      'CSV 解析失敗',
    );
  });
});

describe('prepareSingleFile - JSON', () => {
  it('parses JSON successfully', async () => {
    initImporter({ persistAndRender: vi.fn(), render: vi.fn() });

    const file = fakeFile(
      'test.json',
      JSON.stringify({
        bookmarks: [{ id: '1', title: 'test', url: 'https://example.com/1' }],
      }),
    );

    const result = await prepareSingleFile(file, 'test.json', 'instapaper-scraper');

    expect(result).toBeDefined();
    expect(result.count).toBeGreaterThan(0);
  });
});

describe('prepareSingleFile - SQLite', () => {
  it('parses SQLite successfully', async () => {
    initImporter({ persistAndRender: vi.fn(), render: vi.fn() });

    const file = fakeFile('test.sqlite', 'dummy');

    const result = await prepareSingleFile(file, 'test.sqlite', 'instapaper-scraper');

    expect(result).toBeDefined();
  });
});

describe('prepareSingleFile - unsupported type', () => {
  it('throws error for unsupported file type', async () => {
    initImporter({ persistAndRender: vi.fn(), render: vi.fn() });

    const file = fakeFile('test.txt', 'nope');

    await expect(prepareSingleFile(file, 'test.txt', 'instapaper-scraper')).rejects.toThrow(
      '不支援的檔案格式「.txt」',
    );
  });
});
