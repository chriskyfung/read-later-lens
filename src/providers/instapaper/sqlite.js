/**
 * @fileoverview SQLite import helper for Instapaper `.db` exports.
 *
 * Uses `sql.js` (WebAssembly). The caller is responsible for initializing the
 * `SQL` static once (see `main.js#initSql`); this module accepts an instance so
 * it stays pure and unit-testable. Behaviour matches the original monolith:
 * read the first table, map columns by name, and normalize each row.
 */

import { normalizeFields, normalizeTags } from '../../model/normalize.js';
import { makeReaderUrl, UNKNOWN_URL } from '../../model/BookmarkRecord.js';
import { detectLanguage } from '../../analytics/detectLanguage.js';

/**
 * @param {Uint8Array} wasmBuffer      Raw bytes of a `.db` file.
 * @param {string} sourceFileId
 * @param {string} sourceFileName
 * @param {string} provider            Fallback provider slug.
 * @param {import('sql.js').initSqlJs.SqlJsStatic} SQL
 * @param {object} [options]
 * @param {boolean} [options.preserveMeta] Round-trip `provider` /
 *   `instapaper_url` columns from the source rows when present.
 * @returns {Promise<{
 *   records: import('../../model/BookmarkRecord.js').BookmarkRecord[],
 *   schema: { table: string, columns: string[] } | null,
 * }>} The normalized rows plus the table layout that was actually read, so
 *   the exporter can re-emit the source's own shape instead of a guessed one.
 *   `schema` is null when the file holds no table at all.
 */
export async function processSqliteAsBookmarks(
  wasmBuffer,
  sourceFileId,
  sourceFileName,
  provider,
  SQL,
  options = {},
) {
  const { preserveMeta = false } = options;
  const db = new SQL.Database(wasmBuffer);

  try {
    const tablesRes = db.exec(`SELECT name FROM sqlite_master WHERE type='table';`);
    let rows = [];
    let schema = null;
    if (tablesRes.length > 0) {
      const tableName = String(tablesRes[0].values[0][0]);
      // Quote the table name so hyphens/special chars don't break the query.
      const quoted = `"${tableName.replace(/"/g, '""')}"`;
      // PRAGMA (not `SELECT *`) is what describes an EMPTY table: sql.js returns
      // `[]` for a query with no result rows, so the column list must come from
      // the schema itself or a valid-but-empty source records no layout.
      const infoRes = db.exec(`PRAGMA table_info(${quoted});`);
      const columns = infoRes.length > 0 ? infoRes[0].values.map((row) => String(row[1])) : [];
      // The layout is recorded even when the table holds no rows: a valid but
      // empty source is still re-exportable in its original shape.
      schema = { table: tableName, columns };
      const queryRes = db.exec(`SELECT * FROM ${quoted}`);
      if (queryRes.length > 0) {
        const cols = queryRes[0].columns;
        rows = queryRes[0].values.map((valArr) => {
          const obj = {};
          for (let i = 0; i < cols.length; i++) obj[cols[i]] = valArr[i];
          return obj;
        });
      }
    }

    return {
      records: rows
        .map((rec, index) => {
          const { id, title, url, preview, content } = normalizeFields(rec, index);
          const rowProvider = preserveMeta && rec.provider ? String(rec.provider) : provider;
          const readerUrl =
            preserveMeta && rec.instapaper_url != null
              ? String(rec.instapaper_url)
              : makeReaderUrl(rowProvider, id);
          return {
            id,
            title,
            url,
            article_preview: preview,
            content,
            source_file_id: sourceFileId,
            source_file_name: sourceFileName,
            detected_language: detectLanguage(title + ' ' + preview),
            tags: normalizeTags(rec.tags),
            instapaper_url: readerUrl,
            provider: rowProvider,
          };
        })
        // Drop URL-less rows (see importFromJsonOrCsv) so a broken table can
        // never inject '#' placeholder bookmarks.
        .filter((record) => record.url !== UNKNOWN_URL),
      schema,
    };
  } finally {
    // sql.js keeps the whole database inside the WASM heap and the Emscripten
    // heap never shrinks, so an unreleased handle costs the file's full size
    // for the rest of the session — on every import, including the ones that
    // fail (a corrupt file only throws at the first query, not the ctor).
    // close() is idempotent, but guard it so a failing teardown can never mask
    // the real parse error.
    try {
      db.close();
    } catch {
      // Already closed, or nothing left to free — the import result stands.
    }
  }
}
