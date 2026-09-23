import { describe, it, expect, beforeAll } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { importJsonOrCsv, importSqlite, resolveImportAdapter } from '../src/providers/index.js';

const SQL_DIST = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  'sql.js',
  'dist',
);

let SQL;
beforeAll(async () => {
  SQL = await initSqlJs({ locateFile: (file) => join(SQL_DIST, file) });
});

const makeSqliteBuffer = () => {
  const db = new SQL.Database();
  db.run(
    'CREATE TABLE bookmarks (id TEXT, title TEXT, url TEXT, article_preview TEXT, tags TEXT);',
  );
  db.run('INSERT INTO bookmarks VALUES (?, ?, ?, ?, ?);', [
    '1',
    'Hello World',
    'https://a.example.com',
    'Preview A',
    'news,tech',
  ]);
  db.run('INSERT INTO bookmarks VALUES (?, ?, ?, ?, ?);', [
    '2',
    '你好世界測試內容',
    'https://b.example.com',
    '內容預覽文字',
    '',
  ]);
  const buffer = db.export();
  db.close();
  return buffer;
};

describe('resolveImportAdapter', () => {
  it('exposes an adapter pair for known and stale profile ids', () => {
    for (const id of ['instapaper-scraper', 'rll-unified', 'unknown-stale-id', undefined]) {
      const adapter = resolveImportAdapter(id);
      expect(typeof adapter.importJsonOrCsv).toBe('function');
      expect(typeof adapter.importSqlite).toBe('function');
    }
  });

  it('instapaper-scraper forces Instapaper metadata even on unified rows', () => {
    const adapter = resolveImportAdapter('instapaper-scraper');
    const [rec] = adapter.importJsonOrCsv(
      [
        {
          id: '5',
          title: 'T',
          url: 'https://x.example.com',
          provider: 'raindrop',
          instapaper_url: 'https://example.com/custom',
        },
      ],
      'f',
      'f.csv',
    );
    expect(rec.provider).toBe('instapaper');
    expect(rec.instapaper_url).toBe('https://www.instapaper.com/read/5');
  });

  it('rll-unified round-trips provider and instapaper_url from the source row', () => {
    const adapter = resolveImportAdapter('rll-unified');
    const [rec] = adapter.importJsonOrCsv(
      [
        {
          id: '5',
          title: 'T',
          url: 'https://x.example.com',
          provider: 'raindrop',
          instapaper_url: 'https://example.com/custom',
        },
      ],
      'f',
      'f.csv',
    );
    expect(rec.provider).toBe('raindrop');
    expect(rec.instapaper_url).toBe('https://example.com/custom');
  });

  it('rll-unified still generates a reader URL when the row has none', () => {
    const adapter = resolveImportAdapter('rll-unified');
    const [rec] = adapter.importJsonOrCsv(
      [{ id: '7', title: 'T', url: 'https://y.example.com' }],
      'f',
      'f.json',
    );
    expect(rec.instapaper_url).toBe('https://www.instapaper.com/read/7');
    expect(rec.provider).toBe('instapaper');
  });
});

describe('importJsonOrCsv', () => {
  it('normalizes fields, tags, language and the reader URL', () => {
    const [rec] = importJsonOrCsv(
      [
        {
          id: 7,
          name: 'Title from alias',
          link: 'https://x.example.com',
          description: 'Preview text',
          tags: 'a,b',
        },
      ],
      'file_1',
      'export.json',
    );
    expect(rec).toMatchObject({
      id: '7',
      title: 'Title from alias',
      url: 'https://x.example.com',
      article_preview: 'Preview text',
      content: 'Preview text',
      source_file_id: 'file_1',
      source_file_name: 'export.json',
      detected_language: 'en',
      tags: ['a', 'b'],
      provider: 'instapaper',
    });
    expect(rec.instapaper_url).toBe('https://www.instapaper.com/read/7');
  });

  it('detects CJK titles', () => {
    const [rec] = importJsonOrCsv([{ id: 1, title: '你好世界測試內容' }], 'f', 'f.json');
    expect(rec.detected_language).toBe('zh');
  });
});

describe('importSqlite', () => {
  it('reads the first table and normalizes rows', async () => {
    const records = await importSqlite(makeSqliteBuffer(), 'file_db', 'export.db', SQL);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      id: '1',
      title: 'Hello World',
      url: 'https://a.example.com',
      article_preview: 'Preview A',
      content: 'Preview A',
      source_file_id: 'file_db',
      source_file_name: 'export.db',
      detected_language: 'en',
      tags: ['news', 'tech'],
    });
    expect(records[0].instapaper_url).toBe('https://www.instapaper.com/read/1');
    expect(records[1].detected_language).toBe('zh');
  });
});
