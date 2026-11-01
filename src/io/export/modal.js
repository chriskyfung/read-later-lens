/**
 * @fileoverview Save/export modal behavior — render + layer-stack open/close.
 *
 * Extracted from src/io/exporter.js when the exporter split into src/io/export/*.
 * Markup lives in src/components/io/saveModal.js; the layer registration lives
 * in src/views/modalListeners.js.
 */

import * as state from '../../core/state';
import { saveSourceFileRowHtml } from '../../components/io';
import { pushLayer, popLayer } from '../../utils/dom';

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
