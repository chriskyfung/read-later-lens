/**
 * @fileoverview Exporter module for saving bookmarks to CSV, JSON, and SQLite.
 * Extracts the export/save-back flow from the monolithic index.html.
 */

import * as state from '../core/state.js';
import { getActiveBookmarks } from '../core/filters.js';
import { saveSourceFileRowHtml } from '../components/io/saveModal.js';
import { downloadBlob, saveFileWithFallback } from '../utils/download.js';
import { hardenRecordsForCsv } from '../utils/csv.js';
import { initSql } from './sqlLoader.js';
import { pushLayer, popLayer, on, showToast } from '../utils/dom.js';

/**
 * Populate the source-file list of the save/export modal without touching
 * the layer stack.
 *
 * Doubles as the layer's `restore`, so a save modal revealed by closing a
 * modal stacked above it re-populates itself.
 *
 * @returns {boolean} Whether the modal content was rendered.
 */
export function renderSaveModal() {
  const container = document.getElementById('saveSourceFilesList');
  if (!container) return false;

  container.innerHTML = '';

  if (state.sourceFiles.size === 0) {
    container.innerHTML = '<span class="text-xs text-slate-500">尚無載入的來源檔案</span>';
  } else {
    state.sourceFiles.forEach((file) => {
      const item = document.createElement('div');
      item.className =
        'p-3 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-between text-xs';
      item.innerHTML = saveSourceFileRowHtml({ file });
      item.querySelector('[data-save-file]').dataset.saveFile = file.id;
      container.appendChild(item);
    });
  }

  return true;
}

/**
 * Opens the save/export modal and populates the list of source files,
 * stacking it on top of any modal that is already open.
 */
export function openSaveModal() {
  if (!renderSaveModal()) return;
  pushLayer('saveModal', { restore: renderSaveModal });
}

/**
 * Hide the save/export modal, revealing the layer beneath it if there is one.
 */
export function closeSaveModal() {
  popLayer('saveModal');
}

/**
 * Columns this app can fill when re-emitting a `.db` source, mapped from the
 * source column name to the bookmark field that supplies its value.
 *
 * Anything not listed here is written as NULL and counted, so an unexpected
 * column is announced rather than silently dropped. `tags` is joined with a
 * comma because that is exactly what `normalizeTags` splits on, which makes the
 * round trip lossless.
 */
const SQLITE_COLUMN_VALUES = {
  id: (b) => b.id,
  title: (b) => b.title,
  url: (b) => b.url,
  preview: (b) => b.article_preview,
  article_preview: (b) => b.article_preview,
  content: (b) => b.content,
  tags: (b) => (Array.isArray(b.tags) ? b.tags.join(',') : (b.tags ?? null)),
  instapaper_url: (b) => b.instapaper_url,
  provider: (b) => b.provider,
};

/**
 * Escape an identifier for use inside a double-quoted SQLite name by doubling
 * any embedded quote — the same rule the read path uses, so a table or column
 * named maliciously cannot inject DDL into the file we emit.
 *
 * @param {string} name
 * @returns {string}
 */
function quoteSqliteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

/**
 * Build the `CREATE TABLE` statement reproducing a source's own layout.
 *
 * Columns are declared TEXT: the app stores every field as a string, and the
 * original declared types are not part of the recorded schema.
 *
 * @param {{table: string, columns: string[]}} schema
 * @returns {string}
 */
function createTableSql(schema) {
  const cols = schema.columns.map((c) => `${quoteSqliteIdentifier(c)} TEXT`).join(', ');
  return `CREATE TABLE ${quoteSqliteIdentifier(schema.table)} (${cols});`;
}

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

  if (file.type === 'csv') {
    // Harden only the rows handed to Papa: a formula-prefixed cell in a title or
    // tag would otherwise execute when the user reopens the file in a
    // spreadsheet. The in-memory records stay untouched.
    const csv = Papa.unparse(hardenRecordsForCsv(fileBookmarks));
    await saveFileWithFallback(csv, file.name, 'text/csv');
  } else if (file.type === 'json') {
    const json = JSON.stringify(fileBookmarks, null, 2);
    await saveFileWithFallback(json, file.name, 'application/json');
  } else if (file.type === 'sqlite' || file.type === 'db') {
    // Without the observed layout there is no honest way to rebuild the file:
    // emitting the app's own schema instead would hand back something that
    // merely looks like the user's original. Say so and let them use the
    // always-persisted unified export.
    const schema = file.sqliteSchema;
    if (!schema || !Array.isArray(schema.columns)) {
      showToast('此來源檔案的原始結構未記錄，無法還原 .db；請改用統一 JSON / CSV 匯出');
      return;
    }

    // Column lookup is case-insensitive, matching how the import path reads
    // them (lowerKeyed) and SQLite's own identifier rules. A source declaring
    // `Title` / `URL` would otherwise find no mapping and be written back as
    // all-NULL while the app held every value.
    const unmapped = schema.columns.filter((c) => !SQLITE_COLUMN_VALUES[c.toLowerCase()]);
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
            const value = SQLITE_COLUMN_VALUES[c.toLowerCase()];
            return value ? value(b) : null;
          }),
        );
      });
      // export() copies the bytes out of the database, so the blob handed to
      // the downloader below stays valid after the handle is released.
      const binaryArray = db.export();
      const blob = new Blob([binaryArray], { type: 'application/octet-stream' });
      downloadBlob(blob, file.name);
    } finally {
      // The handle holds an in-WASM-heap database for the rest of the session.
      // close() is idempotent, but guard it so a failing teardown can never
      // mask the real export error (see processSqliteAsBookmarks).
      try {
        db.close();
      } catch {
        // Already closed, or nothing left to free — the download already ran.
      }
    }

    // The file is structurally faithful, but any column the app has no value
    // for came back as NULL. Report that rather than implying a clean copy.
    if (unmapped.length > 0) {
      showToast(`已匯出 ${file.name}，但有 ${unmapped.length} 個欄位無對應資料，已寫入空白`);
    }
  }
}

/**
 * Exports all current bookmarks to a versioned unified JSON file (trash
 * excluded). The envelope (`format` + `version`) gives re-imports an exact
 * fingerprint instead of a column guess; the importer already unwraps the
 * `bookmarks` array, so plain pre-envelope files keep round-tripping.
 */
export function exportAllUnifiedJson() {
  const envelope = {
    format: 'read-later-lens',
    version: 1,
    bookmarks: getActiveBookmarks(),
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, 'all_bookmarks_export.json');
}

/**
 * Exports all current bookmarks to a unified CSV file (trash excluded).
 */
export function exportAllUnifiedCsv() {
  const csv = Papa.unparse(hardenRecordsForCsv(getActiveBookmarks()));
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, 'all_bookmarks_export.csv');
}

/**
 * Delegated handler for the per-source 儲存/下載 buttons rendered into the save
 * modal. Delegation (rather than per-row listeners) survives the re-render that
 * happens on every modal open / layer restore.
 *
 * @param {MouseEvent} e
 */
function handleSaveFileClick(e) {
  const btn = e.target.closest('[data-save-file]');
  if (!btn) return;
  // The export is async and the handler is a plain DOM listener, so a rejection
  // here would surface as an unhandled promise with nothing on screen. Report it
  // the way the import path does rather than failing silently.
  Promise.resolve(saveSingleFile(btn.dataset.saveFile)).catch((err) => {
    console.error('檔案匯出失敗:', err);
    showToast('檔案匯出失敗，請稍後再試');
  });
}

/**
 * Static wiring contract for the export surface: `[element id, event, handler]`.
 *
 * Kept as data so the contract is enumerable: tests assert every entry exists in
 * the mounted markup, which turns a renamed/relocated modal id into a CI failure
 * instead of a silently dead export button.
 *
 * @type {Array<[string, string, EventListener]>}
 */
export const EXPORT_LISTENERS = [
  ['saveBackBtn', 'click', openSaveModal],
  ['closeSaveBtn', 'click', closeSaveModal],
  ['exportAllUnifiedJsonBtn', 'click', exportAllUnifiedJson],
  ['exportAllUnifiedCsvBtn', 'click', exportAllUnifiedCsv],
];

/**
 * Register DOM listeners for export buttons.
 *
 * Every binding goes through `on()`, which no-ops (with a console warning) on
 * missing markup. One absent element must never throw — that used to abort this
 * function *mid-way* (leaving the module half-wired) and, because boot wraps no
 * try/catch around the registration phase, also skipped cache restore and the
 * first render entirely.
 */
export function registerExporterListeners() {
  // Delegated: the per-source rows are re-rendered on every modal open/restore.
  on('saveSourceFilesList', 'click', handleSaveFileClick);
  for (const [id, type, handler] of EXPORT_LISTENERS) on(id, type, handler);
}
