/**
 * @fileoverview Modal listener registration — close buttons + keyboard + reader actions.
 *
 * Extracted from the monolith's DOMContentLoaded block in index.html. Must be
 * called AFTER mountModals() (src/components/modals.js) so the buttons exist.
 * All other modal button wiring (save/back, unified exports, duplicate
 * resolution, file input) lives with its owning feature module (src/io/*).
 *
 * This module is a leaf (imported only by src/main.js and its test) and is the
 * safe wiring surface for the reader's delete and similarity buttons: it can
 * import confirmDeleteBookmark from workspaceActions.js and closeSaveModal from
 * exporter.js without closing the workspaceActions -> bookmarks -> readerModal
 * cycle.
 *
 * It also registers every stackable overlay with the layer stack
 * (src/utils/dom.js) and owns the single document-level keydown handler: Escape
 * unwinds one layer per press, Tab stays inside the topmost layer.
 */

import { closeReaderModal, getReaderBookmarkId } from './readerModal.js';
import { openSimilarityModal, closeSimilarityModal } from './similarityModal.js';
import { confirmDeleteBookmark } from './workspaceActions.js';
import { closeSaveModal } from '../io/exporter.js';
import { closeLayer, registerModalLayer, topLayer, topLayerId, trapFocus } from '../utils/dom.js';

/**
 * Close the topmost layer on Escape and keep Tab focus inside it. No-ops when
 * no modal is open, so background keyboard behaviour is untouched.
 *
 * @param {KeyboardEvent} event
 */
function handleKeydown(event) {
  const id = topLayerId();
  if (!id) return;
  if (event.key === 'Escape') {
    closeLayer(id);
    event.preventDefault();
  } else if (event.key === 'Tab') {
    trapFocus(topLayer(), event);
  }
}

/**
 * Register each overlay's chrome with the layer stack, attach the close
 * handlers, and install the shared keydown handler.
 */
export function registerModalListeners() {
  registerModalLayer('readerModal', { close: closeReaderModal });
  registerModalLayer('similarityModal', { close: closeSimilarityModal });
  registerModalLayer('saveModal', { close: closeSaveModal });

  document.getElementById('closeReaderBtn')?.addEventListener('click', closeReaderModal);
  document.getElementById('closeSimilarityBtn')?.addEventListener('click', closeSimilarityModal);

  // Reader actions. Confirm-gated delete reuses the workspaceActions primitive;
  // a cancelled confirm leaves the reader open. The similarity button stacks the
  // drawer on top of the reader instead of replacing it, so closing the drawer
  // reveals the article again.
  document.getElementById('readerDeleteBtn')?.addEventListener('click', () => {
    const id = getReaderBookmarkId();
    if (id && confirmDeleteBookmark(id)) closeReaderModal();
  });
  document.getElementById('readerSimilarityBtn')?.addEventListener('click', () => {
    const id = getReaderBookmarkId();
    if (id) openSimilarityModal(id);
  });

  document.addEventListener('keydown', handleKeydown);
}
