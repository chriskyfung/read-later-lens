/**
 * @fileoverview Exporter module for saving bookmarks to CSV, JSON, and SQLite.
 * Extracts the export/save-back flow from the monolithic index.html.
 */

import * as state from '../core/state.js';
import { getActiveBookmarks } from '../core/filters.js';
import { saveSourceFileRowHtml } from '../components/io/saveModal.js';
import { downloadBlob, saveFileWithFallback } from '../utils/download.js';
import { initSql } from './sqlLoader.js';
import { pushLayer, popLayer, on } from '../utils/dom.js';

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
    const csv = Papa.unparse(fileBookmarks);
    await saveFileWithFallback(csv, file.name, 'text/csv');
  } else if (file.type === 'json') {
    const json = JSON.stringify(fileBookmarks, null, 2);
    await saveFileWithFallback(json, file.name, 'application/json');
  } else if (file.type === 'sqlite' || file.type === 'db') {
    const sqlEngine = await initSql();
    const db = new sqlEngine.Database();
    try {
      db.run('CREATE TABLE bookmarks (id TEXT, title TEXT, url TEXT, article_preview TEXT);');
      fileBookmarks.forEach((b) => {
        db.run('INSERT INTO bookmarks VALUES (?, ?, ?, ?);', [
          b.id,
          b.title,
          b.url,
          b.article_preview,
        ]);
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
  const csv = Papa.unparse(getActiveBookmarks());
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
  if (btn) saveSingleFile(btn.dataset.saveFile);
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
