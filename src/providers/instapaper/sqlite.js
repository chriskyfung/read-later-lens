/**
 * @fileoverview SQLite import helper for Instapaper `.db` exports.
 *
 * Uses `sql.js` (WebAssembly). The caller is responsible for initializing the
 * `SQL` static once (see `main.js#initSql`); this module accepts an instance so
 * it stays pure and unit-testable. Behaviour matches the original monolith:
 * read the first table, map columns by name, and normalize each row.
 */

import { normalizeFields, normalizeTags } from '../../model/normalize.js';
import { makeReaderUrl } from '../../model/BookmarkRecord.js';
import { detectLanguage } from '../../analytics/detectLanguage.js';

/**
 * @param {Uint8Array} wasmBuffer      Raw bytes of a `.db` file.
 * @param {string} sourceFileId
 * @param {string} sourceFileName
 * @param {string} provider
 * @param {import('sql.js').initSqlJs.SqlJsStatic} SQL
 * @returns {Promise<import('../../model/BookmarkRecord.js').BookmarkRecord[]>}
 */
export async function processSqliteAsBookmarks(
  wasmBuffer,
  sourceFileId,
  sourceFileName,
  provider,
  SQL,
) {
  const db = new SQL.Database(wasmBuffer);

  const tablesRes = db.exec(`SELECT name FROM sqlite_master WHERE type='table';`);
  let rows = [];
  if (tablesRes.length > 0) {
    const tableName = tablesRes[0].values[0][0];
    // Quote the table name so hyphens/special chars don't break the query.
    const queryRes = db.exec(`SELECT * FROM "${tableName}"`);
    if (queryRes.length > 0) {
      const cols = queryRes[0].columns;
      rows = queryRes[0].values.map((valArr) => {
        const obj = {};
        for (let i = 0; i < cols.length; i++) obj[cols[i]] = valArr[i];
        return obj;
      });
    }
  }

  return rows.map((rec, index) => {
    const { id, title, url, preview, content } = normalizeFields(rec, index);
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
      instapaper_url: makeReaderUrl(provider, id),
      provider,
    };
  });
}
