/**
 * @fileoverview Exporter module for saving bookmarks to CSV, JSON, and SQLite.
 * Extracts the export/save-back flow from the monolithic index.html.
 */

import * as state from '../core/state.js';
import { downloadBlob, saveFileWithFallback } from '../utils/download.js';
import { initSql } from './sqlLoader.js';

/**
 * Opens the save/export modal and populates the list of source files.
 */
export function openSaveModal() {
  const container = document.getElementById('saveSourceFilesList');
  if (!container) return;

  container.innerHTML = '';

  if (state.sourceFiles.size === 0) {
    container.innerHTML = '<span class="text-xs text-slate-500">尚無載入的來源檔案</span>';
  } else {
    state.sourceFiles.forEach(file => {
      const item = document.createElement('div');
      item.className = 'p-3 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-between text-xs';
      item.innerHTML = `
        <div>
          <div class="font-medium text-slate-200 truncate flex-1">${file.name}</div>
          <div class="text-slate-500 text-[10px] uppercase font-bold">${file.type} 格式</div>
        </div>
        <button onclick="window.IBM.saveSingleFile('${file.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition">儲存/下載</button>
      `;
      container.appendChild(item);
    });
  }

  document.getElementById('saveModal').classList.remove('hidden');
}

/**
 * Saves a single source file's bookmarks back to disk.
 * @param {string} fileId
 */
export async function saveSingleFile(fileId) {
  const file = state.sourceFiles.get(fileId);
  if (!file) return;

  const fileBookmarks = state.bookmarks.filter(b => b.source_file_id === fileId);

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
    fileBookmarks.forEach(b => {
      db.run('INSERT INTO bookmarks VALUES (?, ?, ?, ?);', [b.id, b.title, b.url, b.article_preview]);
    });
    const binaryArray = db.export();
    const blob = new Blob([binaryArray], { type: 'application/octet-stream' });
    downloadBlob(blob, file.name);
  }
}

/**
 * Exports all current bookmarks to a unified JSON file.
 */
export function exportAllUnifiedJson() {
  const blob = new Blob([JSON.stringify(state.bookmarks, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'all_bookmarks_export.json');
}

/**
 * Exports all current bookmarks to a unified CSV file.
 */
export function exportAllUnifiedCsv() {
  const csv = Papa.unparse(state.bookmarks);
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, 'all_bookmarks_export.csv');
}

/**
 * Register DOM listeners for export buttons.
 */
export function registerExporterListeners() {
  document.getElementById('saveBackBtn').addEventListener('click', openSaveModal);
  document.getElementById('closeSaveBtn').addEventListener('click', () => {
    document.getElementById('saveModal').classList.add('hidden');
  });
  document.getElementById('exportAllUnifiedJsonBtn').addEventListener('click', exportAllUnifiedJson);
  document.getElementById('exportAllUnifiedCsvBtn').addEventListener('click', exportAllUnifiedCsv);
}
