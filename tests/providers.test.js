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

/**
 * Wraps the real engine so a test can assert the database is released.
 * Subclassing the real `Database` keeps genuine SQLite semantics — only
 * `close()` is observed, so a passing assertion cannot be an accident.
 *
 * @param {object} SQL Real sql.js static from `initSqlJs`.
 * @returns {{ engine: { Database: Function }, closed: object[] }}
 */
const trackingEngine = (SQL) => {
  const closed = [];
  class TrackingDatabase extends SQL.Database {
    close() {
      closed.push(this);
      return super.close();
    }
  }
  return { engine: { Database: TrackingDatabase }, closed };
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
    const [rec] = importJsonOrCsv(
      [{ id: 1, title: '你好世界測試內容', url: 'https://zh.example.com' }],
      'f',
      'f.json',
    );
    expect(rec.detected_language).toBe('zh');
  });

  it('drops rows without a usable URL instead of storing # placeholders', () => {
    const records = importJsonOrCsv(
      [
        { id: '1', title: 'Kept', url: 'https://keep.example.com' },
        { id: '2', title: 'No url at all' },
        { id: '3', title: 'Empty url', url: '' },
      ],
      'f',
      'f.csv',
    );
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('1');
  });

  it('generates the same stable id when the same id-less file is re-imported', () => {
    const rows = [{ title: 'Id-less', url: 'https://same.example.com/post' }];
    const [first] = importJsonOrCsv(rows, 'f1', 'a.csv');
    const [second] = importJsonOrCsv(rows, 'f2', 'b.csv');
    expect(first.id).toMatch(/^gen_/);
    expect(first.id).toBe(second.id); // merges on re-import instead of duplicating
  });
});

describe('importSqlite', () => {
  it('reads the first table and normalizes rows', async () => {
    const { records } = await importSqlite(makeSqliteBuffer(), 'file_db', 'export.db', SQL);
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

  it('releases the SQLite database after a successful import', async () => {
    const { engine, closed } = trackingEngine(SQL);
    const { records } = await importSqlite(makeSqliteBuffer(), 'file_db', 'export.db', engine);

    // The result is fully materialized before the handle goes away.
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ id: '1', title: 'Hello World' });
    expect(closed).toHaveLength(1);
    expect(closed[0].db).toBeNull();
  });

  it('reports the observed table name and columns alongside the records', async () => {
    // The exporter re-emits this layout, so it must be the layout the file
    // actually had — not a schema the app assumes.
    const { schema } = await importSqlite(makeSqliteBuffer(), 'file_db', 'export.db', SQL);
    expect(schema).toEqual({
      table: 'bookmarks',
      columns: ['id', 'title', 'url', 'article_preview', 'tags'],
    });
  });

  it('reports the schema for a valid table that holds no rows', async () => {
    const db = new SQL.Database();
    db.run('CREATE TABLE articles (id TEXT, title TEXT);');
    const buffer = db.export();
    db.close();

    const { records, schema } = await importSqlite(buffer, 'file_db', 'empty.db', SQL);
    // An empty source is still re-exportable in its original shape.
    expect(records).toEqual([]);
    expect(schema).toEqual({ table: 'articles', columns: ['id', 'title'] });
  });

  it('reports a null schema for a database with no tables', async () => {
    const db = new SQL.Database();
    const buffer = db.export();
    db.close();

    const { records, schema } = await importSqlite(buffer, 'file_db', 'notables.db', SQL);
    expect(records).toEqual([]);
    expect(schema).toBeNull();
  });

  it('releases the SQLite database when the file cannot be parsed', async () => {
    const { engine, closed } = trackingEngine(SQL);
    // Garbage bytes are accepted by the constructor and only rejected at the
    // first query — exactly the path that used to strand the handle, once per
    // corrupt or mislabelled file.
    const corrupt = new Uint8Array(65536);

    await expect(importSqlite(corrupt, 'file_db', 'corrupt.db', engine)).rejects.toThrow();
    expect(closed).toHaveLength(1);
    expect(closed[0].db).toBeNull();
  });
});
