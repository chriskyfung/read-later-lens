/**
 * @fileoverview Instapaper import adapters.
 *
 * Converts Instapaper CSV/JSON/SQLite exports into normalized BookmarkRecord
 * shapes via `src/model/normalize`. Field resolution is intentionally tolerant
 * (alias-based) so it round-trips the original monolith's `processRawRecords`.
 */

import { normalizeFields, normalizeTags } from '../../model/normalize.js';
import { processSqliteAsBookmarks } from './sqlite.js';
import { makeReaderUrl } from '../../model/BookmarkRecord.js';
import { detectLanguage } from '../../analytics/detectLanguage.js';

/**
 * @param {string[]|Record[]} rawRows      PapaParse rows (CSV) or JSON items.
 * @param {string} sourceFileId
 * @param {string} sourceFileName
 * @returns {import('../../model/BookmarkRecord.js').BookmarkRecord[]}
 */
export function importFromJsonOrCsv(rawRows, sourceFileId, sourceFileName) {
  return rawRows.map((rec, index) => {
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
      instapaper_url: makeReaderUrl('instapaper', id),
      provider: 'instapaper',
    };
  });
}

/**
 * @param {Uint8Array} wasmBuffer
 * @param {string} sourceFileId
 * @param {string} sourceFileName
 * @param {import('sql.js').initSqlJs.SqlJsStatic} SQL
 * @returns {Promise<import('../../model/BookmarkRecord.js').BookmarkRecord[]>}
 */
export function importFromSqlite(wasmBuffer, sourceFileId, sourceFileName, SQL) {
  return processSqliteAsBookmarks(wasmBuffer, sourceFileId, sourceFileName, 'instapaper', SQL);
}
