/**
 * @fileoverview Instapaper import adapters.
 *
 * Converts Instapaper CSV/JSON/SQLite exports into normalized BookmarkRecord
 * shapes via `src/model/normalize`. Field resolution is intentionally tolerant
 * (alias-based) so it round-trips the original monolith's `processRawRecords`.
 */

import { normalizeFields, normalizeTags } from '../../model/normalize.js';
import { processSqliteAsBookmarks } from './sqlite.js';
import { makeReaderUrl, UNKNOWN_URL } from '../../model/BookmarkRecord.js';
import { detectLanguage } from '../../analytics/detectLanguage.js';

/**
 * @param {string[]|Record[]} rawRows      PapaParse rows (CSV) or JSON items.
 * @param {string} sourceFileId
 * @param {string} sourceFileName
 * @param {object} [options]
 * @param {boolean} [options.preserveMeta] Round-trip `provider` /
 *   `instapaper_url` from the source record (Read Later Lens unified profile)
 *   instead of forcing Instapaper values.
 * @returns {import('../../model/BookmarkRecord.js').BookmarkRecord[]}
 */
export function importFromJsonOrCsv(rawRows, sourceFileId, sourceFileName, options = {}) {
  const { preserveMeta = false } = options;
  return (
    rawRows
      .map((rec, index) => {
        const { id, title, url, preview, content } = normalizeFields(rec, index);
        const provider = preserveMeta && rec.provider ? String(rec.provider) : 'instapaper';
        const readerUrl =
          preserveMeta && rec.instapaper_url != null
            ? String(rec.instapaper_url)
            : makeReaderUrl(provider, id);
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
          provider,
        };
      })
      // A bookmark without a usable URL cannot be opened, resolved to a
      // domain, or compared — drop it here so the importer can report the
      // gap instead of storing a '#' placeholder row.
      .filter((record) => record.url !== UNKNOWN_URL)
  );
}

/**
 * @param {Uint8Array} wasmBuffer
 * @param {string} sourceFileId
 * @param {string} sourceFileName
 * @param {import('sql.js').initSqlJs.SqlJsStatic} SQL
 * @param {object} [options] See importFromJsonOrCsv.
 * @returns {Promise<import('../../model/BookmarkRecord.js').BookmarkRecord[]>}
 */
export function importFromSqlite(wasmBuffer, sourceFileId, sourceFileName, SQL, options = {}) {
  return processSqliteAsBookmarks(
    wasmBuffer,
    sourceFileId,
    sourceFileName,
    'instapaper',
    SQL,
    options,
  );
}
