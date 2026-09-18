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
 * cycle. A single document-level keydown handler closes the topmost modal on
 * Escape and folds Tab focus back inside the active modal.
 */

import { closeReaderModal, getReaderBookmarkId } from './readerModal.js';
import { openSimilarityModal, closeSimilarityModal } from './similarityModal.js';
import { confirmDeleteBookmark } from './workspaceActions.js';
import { closeSaveModal } from '../io/exporter.js';
import { trapFocus } from '../utils/dom.js';

/**
 * Overlay ids in document order (bottom -> top). Escape unwinds them one at a
 * time, always targeting the topmost visible overlay.
 */
const MODAL_LAYERS = [
  { id: 'readerModal', close: closeReaderModal },
  { id: 'similarityModal', close: closeSimilarityModal },
  { id: 'saveModal', close: closeSaveModal },
];

/**
 * Find the topmost currently-visible modal layer.
 *
 * @returns {{id: string, close: Function}|null}
 */
function topmostOpenModal() {
  for (let i = MODAL_LAYERS.length - 1; i >= 0; i -= 1) {
    const overlay = document.getElementById(MODAL_LAYERS[i].id);
    if (overlay && !overlay.classList.contains('hidden')) return MODAL_LAYERS[i];
  }
  return null;
}

/**
 * Close the topmost modal on Escape and keep Tab focus inside it. No-ops when
 * no modal is open, so background keyboard behaviour is untouched.
 *
 * @param {KeyboardEvent} event
 */
function handleKeydown(event) {
  const layer = topmostOpenModal();
  if (!layer) return;
  if (event.key === 'Escape') {
    layer.close();
    event.preventDefault();
  } else if (event.key === 'Tab') {
    trapFocus(document.getElementById(layer.id), event);
  }
}

/**
 * Attach close handlers for the reader and similarity modals plus the shared
 * keyboard handler (Escape to close, Tab to stay inside).
 */
export function registerModalListeners() {
  document.getElementById('closeReaderBtn')?.addEventListener('click', closeReaderModal);
  document.getElementById('closeSimilarityBtn')?.addEventListener('click', closeSimilarityModal);

  // Reader actions (Phase 2). Confirm-gated delete reuses the workspaceActions
  // primitive; a cancelled confirm leaves the reader open. The similarity button
  // closes the reader and opens the similarity drawer for the same bookmark
  // (mirrors the similarity-row click ordering in src/views/similarityModal.js).
  document.getElementById('readerDeleteBtn')?.addEventListener('click', () => {
    const id = getReaderBookmarkId();
    if (id && confirmDeleteBookmark(id)) closeReaderModal();
  });
  document.getElementById('readerSimilarityBtn')?.addEventListener('click', () => {
    const id = getReaderBookmarkId();
    if (id) {
      closeReaderModal();
      openSimilarityModal(id);
    }
  });

  document.addEventListener('keydown', handleKeydown);
}
