/**
 * @fileoverview Exporter module for saving bookmarks to CSV, JSON, and SQLite.
 * Extracts the export/save-back flow from the monolithic index.html.
 */

import * as state from '../core/state.js';
import { getActiveBookmarks } from '../core/filters.js';
import { downloadBlob, saveFileWithFallback } from '../utils/download.js';
import { initSql } from './sqlLoader.js';
import { pushLayer, popLayer } from '../utils/dom.js';

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
      item.innerHTML = `
        <div>
          <div class="font-medium text-slate-200 truncate flex-1">${file.name}</div>
          <div class="text-slate-500 text-[10px] uppercase font-bold">${file.type} 格式</div>
        </div>
        <button data-save-file class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition">儲存/下載</button>
      `;
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
    db.run('CREATE TABLE bookmarks (id TEXT, title TEXT, url TEXT, article_preview TEXT);');
    fileBookmarks.forEach((b) => {
      db.run('INSERT INTO bookmarks VALUES (?, ?, ?, ?);', [
        b.id,
        b.title,
        b.url,
        b.article_preview,
      ]);
    });
    const binaryArray = db.export();
    const blob = new Blob([binaryArray], { type: 'application/octet-stream' });
    downloadBlob(blob, file.name);
  }
}

/**
 * Exports all current bookmarks to a unified JSON file (trash excluded).
 */
export function exportAllUnifiedJson() {
  const blob = new Blob([JSON.stringify(getActiveBookmarks(), null, 2)], {
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
 * Register DOM listeners for export buttons.
 */
export function registerExporterListeners() {
  document.getElementById('saveSourceFilesList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save-file]');
    if (btn) saveSingleFile(btn.dataset.saveFile);
  });
  document.getElementById('saveBackBtn')?.addEventListener('click', openSaveModal);
  document.getElementById('closeSaveBtn')?.addEventListener('click', closeSaveModal);
  document
    .getElementById('exportAllUnifiedJsonBtn')
    .addEventListener('click', exportAllUnifiedJson);
  document.getElementById('exportAllUnifiedCsvBtn').addEventListener('click', exportAllUnifiedCsv);
}
