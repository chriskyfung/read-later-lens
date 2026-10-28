/**
 * @fileoverview Per-source save-back writer — CSV, JSON and SQLite.
 *
 * Extracted from src/io/exporter.js when the exporter split into src/io/export/*.
 * Ordering inside saveSingleFile is verbatim from the monolith: column
 * selection → harden → write → unmapped-column report.
 */

import * as state from '../../core/state';
import { getActiveBookmarks } from '../../core/filters.js';
import { saveFileWithFallback } from '../../utils/download.js';
import { csvUnparseConfig, hardenRecordsForCsv } from '../../utils/csv.js';
import { showToast } from '../../utils/dom';
import { initSql } from '../sqlLoader.js';
import {
  exportColumnsFor,
  projectRecord,
  sourceColumnReader,
  unfillableColumns,
} from './columns.js';
import { quoteSqliteIdentifier, createTableSql } from './sqlite.js';
import Papa from 'papaparse';

/**
 * Saves a single source file's bookmarks back to disk.
 *
 * Trashed bookmarks are excluded: the trash is a local holding area, and
 * exporting it would silently resurrect deleted items in the user's file.
 *
 * @param {string} fileId
 */
export async function saveSingleFile(fileId) {
  const file = state.sourceFiles.get(fileId);
  if (!file) return;

  const fileBookmarks = getActiveBookmarks().filter((b) => b.source_file_id === fileId);

  if (file.type === 'csv' || file.type === 'json') {
    // Re-emit the SOURCE's own layout, not the app's internal schema: a scraper
    // CSV saved back with `source_file_id` / `detected_language` no longer
    // resembles the user's file, and re-importing it warns that it "looks more
    // like a Read Later Lens export". `null` columns (unified, or no recorded
    // profile) keeps the lossless internal shape, which is what that export is.
    const columns = exportColumnsFor(file);
    const rows = columns ? fileBookmarks.map((b) => projectRecord(b, columns)) : fileBookmarks;

    if (file.type === 'csv') {
      // Harden only the rows handed to Papa: a formula-prefixed cell in a title or
      // tag would otherwise execute when the user reopens the file in a
      // spreadsheet. Hardening runs AFTER the column selection, so a projected
      // row is protected exactly like a raw one. The in-memory records stay
      // untouched.
      // Re-emit in the dialect the source was read with, not a fixed comma +
      // CRLF. The config is the only correct place for this: Papa quotes a cell
      // only when it contains the *configured* delimiter, so post-processing the
      // emitted string would write bare semicolons into cells that were never
      // quoted. An unknown dialect (a folder rebuilt from a unified export, a
      // cache from a version that predates capture) falls back to RFC 4180.
      const csv = Papa.unparse(hardenRecordsForCsv(rows), csvUnparseConfig(file.csvDialect));
      await saveFileWithFallback(csv, file.name, 'text/csv');
    } else {
      const json = JSON.stringify(rows, null, 2);
      await saveFileWithFallback(json, file.name, 'application/json');
    }

    // The file is structurally faithful, but any column the app has no value for
    // came back empty. Report that rather than implying a clean copy.
    if (columns) {
      const unmapped = unfillableColumns(columns);
      if (unmapped.length > 0) {
        showToast(`已匯出 ${file.name}，但有 ${unmapped.length} 個欄位無對應資料，已寫入空白`);
      }
    }
  } else if (file.type === 'sqlite' || file.type === 'db') {
    // Without the observed layout there is no honest way to rebuild the file:
    // emitting the app's own schema instead would hand back something that
    // merely looks like the user's original. Say so and let them use the
    // always-persisted unified export. An empty column list is refused for the
    // same reason: PRAGMA table_info yields no rows for a name it cannot
    // introspect, and `CREATE TABLE "x" ()` is a syntax error, so emitting it
    // would surface a parser message from sql.js instead of this one. The table
    // name is checked by type rather than truthiness on purpose: `""` is a
    // legal SQLite table name and must still round-trip as `CREATE TABLE ""`,
    // whereas a missing name would otherwise be quoted into a table literally
    // called "undefined".
    const schema = file.sqliteSchema;
    if (
      !schema ||
      typeof schema.table !== 'string' ||
      !Array.isArray(schema.columns) ||
      schema.columns.length === 0
    ) {
      showToast('此來源檔案的原始結構未記錄，無法還原 .db；請改用統一 JSON / CSV 匯出');
      return;
    }

    // Column lookup is case-insensitive, matching how the import path reads
    // them (lowerKeyed) and SQLite's own identifier rules. A source declaring
    // `Title` / `URL` would otherwise find no mapping and be written back as
    // all-NULL while the app held every value.
    const unmapped = schema.columns.filter((c) => !sourceColumnReader(c));
    const sqlEngine = await initSql();
    const db = new sqlEngine.Database();
    try {
      const table = quoteSqliteIdentifier(schema.table);
      db.run(createTableSql(schema));
      const placeholders = schema.columns.map(() => '?').join(', ');
      fileBookmarks.forEach((b) => {
        db.run(
          `INSERT INTO ${table} VALUES (${placeholders});`,
          schema.columns.map((c) => {
            const value = sourceColumnReader(c);
            return value ? value(b) : null;
          }),
        );
      });
      // export() copies the bytes out of the database, so the buffer handed to
      // the saver below stays valid after the handle is released. Blob clones
      // its input, so the bytes are copied once more inside the helper rather
      // than pinned until the object URL is revoked. Same Save-As pipeline as
      // every other source type: picker where the browser has one, download
      // everywhere else.
      const binaryArray = db.export();
      await saveFileWithFallback(binaryArray, file.name, 'application/octet-stream');
    } finally {
      // The handle holds an in-WASM-heap database for the rest of the session.
      // close() is idempotent, but guard it so a failing teardown can never
      // mask the real export error (see processSqliteAsBookmarks).
      try {
        db.close();
      } catch {
        // Already closed, or nothing left to free — the save already ran.
      }
    }

    // The file is structurally faithful, but any column the app has no value
    // for came back as NULL. Report that rather than implying a clean copy.
    if (unmapped.length > 0) {
      showToast(`已匯出 ${file.name}，但有 ${unmapped.length} 個欄位無對應資料，已寫入空白`);
    }
  }
}
