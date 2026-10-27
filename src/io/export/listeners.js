/**
 * @fileoverview Export-surface DOM listener wiring.
 *
 * Extracted from src/io/exporter.js when the exporter split into src/io/export/*.
 */

import { on, showToast } from '../../utils/dom';
import { openSaveModal, closeSaveModal } from './modal.js';
import { saveSingleFile } from './singleFile.js';
import { exportAllUnifiedJson, exportAllUnifiedCsv } from './unified.js';

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
